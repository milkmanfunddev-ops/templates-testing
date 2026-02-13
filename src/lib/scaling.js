/**
 * Template Scaling Algorithm — Grid Search Over Friendly Fractions
 *
 * Instead of scaling proportionally and rounding, we enumerate all valid
 * combinations of friendly-fraction servings and pick the one that best
 * satisfies carb, hydration, and sodium targets simultaneously.
 *
 * Scale Groups:
 * Foods with the same `scale_group` string scale by a shared multiplier
 * applied to their default_servings. This ensures proportional scaling
 * for items that form a logical dish (e.g., bread + PB in a sandwich).
 * Foods without a scale_group scale independently as before.
 *
 * Algorithm:
 * 1. Partition foods into scale groups and independent items
 * 2. For groups: generate multiplier values, apply to all foods in group
 * 3. For independent: generate per-food friendly fraction values
 * 4. Enumerate all combinations (prune if search space > 500K)
 * 5. Score each combination: carbs(50%) + hydration(30%) + sodium(20%)
 * 6. Return the best combination
 */

// ============================================================================
// UNIT-AWARE FRIENDLY FRACTIONS
// ============================================================================

/**
 * Detect the unit category from a serving_size string.
 */
function detectUnitCategory(servingSize) {
  const s = (servingSize || '').toLowerCase();
  if (/\bcups?\b/.test(s)) return 'cup';
  if (/\b(tbsp|tablespoons?)\b/.test(s)) return 'tbsp';
  if (/\b(tsp|teaspoons?)\b/.test(s)) return 'tsp';
  if (/\b(fl\.?\s*oz|fluid\s*oz)\b/.test(s)) return 'oz';
  if (/\boz\b/.test(s)) return 'oz';
  if (/\b(ml|milliliters?)\b/.test(s)) return 'ml';
  if (/\bgrams?\b/.test(s)) return 'g';
  if (/\b(banana|egg|slice|bar|packet|scoop|piece|strip|waffle|pancake|muffin|bagel|chew|gel|date|fig|cracker|pretzel|tortilla|medium|large|small|whole|link|patty|square|ball|ring|pouch|tab|serving|package)\b/.test(s)) return 'whole';
  return 'default';
}

/**
 * Allowed fractional snap points (0 to <1) per unit category.
 */
const SNAP_FRACTIONS = {
  cup:     [0, 1/4, 1/3, 1/2, 2/3, 3/4],
  tbsp:    [0, 0.5],
  tsp:     [0, 0.5],
  oz:      [0, 0.5],
  ml:      [0],
  g:       [0],
  whole:   [0, 0.5],
  default: [0, 0.25, 0.5, 0.75],
};

/**
 * Generate all valid friendly-fraction serving values between min and max.
 * For cups [0.5, 3]: → [1/2, 2/3, 3/4, 1, 1 1/4, 1 1/3, 1 1/2, ..., 3]
 * For whole [0.5, 3]: → [1/2, 1, 1 1/2, 2, 2 1/2, 3]
 */
function generateFriendlyValues(minServings, maxServings, unitCategory) {
  const fractions = SNAP_FRACTIONS[unitCategory] || SNAP_FRACTIONS.default;
  const values = [];

  const maxWhole = Math.ceil(maxServings);
  for (let w = 0; w <= maxWhole; w++) {
    for (const frac of fractions) {
      const val = w + frac;
      if (val >= minServings - 0.001 && val <= maxServings + 0.001) {
        values.push(Math.round(val * 10000) / 10000);
      }
    }
  }

  // Sort and deduplicate (with tolerance for floating point)
  values.sort((a, b) => a - b);
  const unique = values.length > 0 ? [values[0]] : [];
  for (let i = 1; i < values.length; i++) {
    if (values[i] - unique[unique.length - 1] > 0.01) {
      unique.push(values[i]);
    }
  }

  // Fallback: ensure at least one value
  if (unique.length === 0) {
    unique.push(minServings);
  }

  return unique;
}

// ============================================================================
// SCALE GROUP MULTIPLIER GENERATION
// ============================================================================

/**
 * Multiplier snap fractions — steps at which a scale group can be multiplied.
 * Covers 0.25x to 4.0x in friendly increments.
 */
const MULTIPLIER_STEPS = [
  0.25, 0.33, 0.5, 0.67, 0.75,
  1.0, 1.25, 1.33, 1.5, 1.67, 1.75,
  2.0, 2.25, 2.5, 2.75, 3.0, 3.5, 4.0,
];

/**
 * Generate valid multiplier values for a scale group.
 * Computes the tightest multiplier range from all foods in the group,
 * then returns the MULTIPLIER_STEPS that fall within that range.
 *
 * @param {Array} groupFoods - Foods in this scale group
 * @returns {number[]} Valid multiplier values
 */
function generateGroupMultipliers(groupFoods) {
  // Find the tightest multiplier range across all foods in the group
  let minMult = 0;
  let maxMult = Infinity;

  for (const f of groupFoods) {
    if (f.default_servings <= 0) continue;
    const foodMin = f.min_servings / f.default_servings;
    const foodMax = f.max_servings / f.default_servings;
    minMult = Math.max(minMult, foodMin);
    maxMult = Math.min(maxMult, foodMax);
  }

  // Filter MULTIPLIER_STEPS to those within the valid range
  const valid = MULTIPLIER_STEPS.filter(m => m >= minMult - 0.01 && m <= maxMult + 0.01);

  // Fallback: if no steps fit, use the midpoint
  if (valid.length === 0) {
    valid.push(Math.round(((minMult + maxMult) / 2) * 100) / 100);
  }

  return valid;
}

/**
 * For a given multiplier, compute the actual serving for each food in the group.
 * Applies the multiplier to default_servings, then snaps to the nearest
 * friendly fraction for the food's unit category, clamped to min/max.
 *
 * @param {Array} groupFoods - Foods in this scale group
 * @param {number} multiplier - The group multiplier
 * @returns {number[]} Serving values for each food in the group
 */
function applyGroupMultiplier(groupFoods, multiplier) {
  return groupFoods.map(f => {
    const raw = f.default_servings * multiplier;
    const unitCat = detectUnitCategory(f.serving_size);
    return snapToFriendlyFraction(raw, f.min_servings, f.max_servings, unitCat);
  });
}

/**
 * Snap a raw serving value to the nearest friendly fraction within min/max.
 */
function snapToFriendlyFraction(raw, minServings, maxServings, unitCategory) {
  const fractions = SNAP_FRACTIONS[unitCategory] || SNAP_FRACTIONS.default;
  const clamped = Math.max(minServings, Math.min(maxServings, raw));

  // Generate all possible snap points up to the clamped value + 1
  const candidates = [];
  const maxWhole = Math.ceil(clamped) + 1;
  for (let w = 0; w <= maxWhole; w++) {
    for (const frac of fractions) {
      const val = w + frac;
      if (val >= minServings - 0.001 && val <= maxServings + 0.001) {
        candidates.push(Math.round(val * 10000) / 10000);
      }
    }
  }

  if (candidates.length === 0) return clamped;

  // Find the candidate closest to the raw value
  let best = candidates[0];
  let bestDist = Math.abs(best - clamped);
  for (let i = 1; i < candidates.length; i++) {
    const dist = Math.abs(candidates[i] - clamped);
    if (dist < bestDist) {
      best = candidates[i];
      bestDist = dist;
    }
  }

  return best;
}

// ============================================================================
// DISPLAY FORMATTING
// ============================================================================

const FRACTION_LABELS = [
  [1/4, '1/4'],
  [1/3, '1/3'],
  [1/2, '1/2'],
  [2/3, '2/3'],
  [3/4, '3/4'],
];

/**
 * Format a serving quantity as a human-friendly string.
 * @param {number} value - The serving count (already a friendly fraction)
 * @returns {string} e.g. "1 1/2", "2/3", "2", "1 1/4"
 */
export function formatFriendlyQuantity(value) {
  if (value <= 0) return '0';

  const whole = Math.floor(value + 0.01);
  const frac = value - whole;

  let fracLabel = '';
  for (const [fracVal, label] of FRACTION_LABELS) {
    if (Math.abs(frac - fracVal) < 0.05) {
      fracLabel = label;
      break;
    }
  }

  if (whole === 0 && fracLabel) return fracLabel;
  if (whole > 0 && fracLabel) return `${whole} ${fracLabel}`;
  return `${whole}`;
}

// ============================================================================
// GRID SEARCH SCALING (with scale_group support)
// ============================================================================

/**
 * Scale a template's foods using grid search over friendly fractions.
 *
 * Foods with the same `scale_group` string scale by a shared multiplier.
 * Foods without a scale_group (or with scale_group=null) scale independently.
 *
 * @param {Array} foods - JSONB foods array from template
 * @param {number} targetCarbsG - Target carbs in grams
 * @param {number|null} hydrationTargetMl - Target fluid in ml (optional)
 * @param {number|null} sodiumTargetMg - Target sodium in mg (optional)
 * @returns {{ scaledFoods: Array, actualCarbs: number, actualProtein: number, actualFat: number, actualSodium: number, actualFluid: number, actualCalories: number }}
 */
export function scaleTemplate(foods, targetCarbsG, hydrationTargetMl = null, sodiumTargetMg = null) {
  if (!foods || foods.length === 0) {
    return { scaledFoods: [], actualCarbs: 0, actualProtein: 0, actualFat: 0, actualSodium: 0, actualFluid: 0, actualCalories: 0 };
  }

  // Partition foods into scale groups and independent items
  const groupMap = new Map(); // group_name -> [{ food, originalIndex }]
  const independentItems = []; // [{ food, originalIndex }]

  foods.forEach((f, i) => {
    const group = f.scale_group;
    if (group) {
      if (!groupMap.has(group)) groupMap.set(group, []);
      groupMap.get(group).push({ food: f, originalIndex: i });
    } else {
      independentItems.push({ food: f, originalIndex: i });
    }
  });

  // If no scale groups, treat ALL foods as one group (proportional recipe scaling).
  // This ensures all items in a template scale together by the same multiplier,
  // e.g. 2 pancakes + 2 tbsp syrup + 1 banana all scale by 1.5x together.
  if (groupMap.size === 0) {
    const allItems = foods.map((f, i) => ({ food: f, originalIndex: i }));
    groupMap.set('_recipe', allItems);
    independentItems.length = 0;
  }

  // Build search dimensions:
  // - One dimension per scale group (multiplier values)
  // - One dimension per independent food (friendly fraction values)
  const groups = [...groupMap.entries()]; // [[name, items], ...]
  const dimensions = []; // Array of { type: 'group'|'independent', values: [], ... }

  for (const [name, items] of groups) {
    const groupFoods = items.map(it => it.food);
    const multipliers = generateGroupMultipliers(groupFoods);
    dimensions.push({
      type: 'group',
      name,
      items,
      multipliers,
      values: multipliers, // for enumeration
    });
  }

  for (const item of independentItems) {
    const unitCat = detectUnitCategory(item.food.serving_size);
    const values = generateFriendlyValues(item.food.min_servings, item.food.max_servings, unitCat);
    dimensions.push({
      type: 'independent',
      item,
      values,
    });
  }

  // Prune if search space is too large
  const MAX_SPACE = 500000;
  const MAX_PER_DIM = 12;
  let totalSpace = dimensions.reduce((p, d) => p * d.values.length, 1);

  if (totalSpace > MAX_SPACE) {
    const baseCarbs = foods.reduce((s, f) => s + f.carbs_g * f.default_servings, 0);
    const carbRatio = baseCarbs > 0 ? targetCarbsG / baseCarbs : 1;

    for (const dim of dimensions) {
      if (dim.values.length <= MAX_PER_DIM) continue;

      if (dim.type === 'group') {
        // For groups, prefer multipliers near the carb ratio
        dim.values = [...dim.values]
          .sort((a, b) => Math.abs(a - carbRatio) - Math.abs(b - carbRatio))
          .slice(0, MAX_PER_DIM)
          .sort((a, b) => a - b);
      } else {
        // For independent foods, prefer values near the ideal
        const f = dim.item.food;
        let ideal = f.default_servings * carbRatio;
        if (f.carbs_g <= 1 && (f.fluid_ml || 0) > 50 && hydrationTargetMl != null) {
          ideal = hydrationTargetMl / (f.fluid_ml || 1);
        } else if (f.carbs_g <= 1 && f.sodium_mg > 20 && sodiumTargetMg != null) {
          ideal = sodiumTargetMg / (f.sodium_mg || 1);
        }
        ideal = Math.max(f.min_servings, Math.min(f.max_servings, ideal));

        dim.values = [...dim.values]
          .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))
          .slice(0, MAX_PER_DIM)
          .sort((a, b) => a - b);
      }
    }
  }

  // Grid search over all dimensions
  const n = foods.length;
  const hasFluid = hydrationTargetMl != null && hydrationTargetMl > 0;
  const hasSodium = sodiumTargetMg != null && sodiumTargetMg > 0;

  // Pre-extract nutrition arrays
  const carbsArr = foods.map(f => f.carbs_g);
  const fluidArr = foods.map(f => f.fluid_ml || 0);
  const sodiumArr = foods.map(f => f.sodium_mg);

  const dimCount = dimensions.length;
  const indices = new Array(dimCount).fill(0);
  let bestScore = -Infinity;
  let bestServings = foods.map(f => f.default_servings);

  while (true) {
    // Build the serving array for this combination
    const servings = new Array(n);

    for (let d = 0; d < dimCount; d++) {
      const dim = dimensions[d];
      if (dim.type === 'group') {
        const multiplier = dim.values[indices[d]];
        const groupServings = applyGroupMultiplier(
          dim.items.map(it => it.food),
          multiplier
        );
        dim.items.forEach((it, gi) => {
          servings[it.originalIndex] = groupServings[gi];
        });
      } else {
        servings[dim.item.originalIndex] = dim.values[indices[d]];
      }
    }

    // Compute macros
    let carbs = 0, fluid = 0, sodium = 0;
    for (let i = 0; i < n; i++) {
      const s = servings[i];
      carbs += carbsArr[i] * s;
      if (hasFluid) fluid += fluidArr[i] * s;
      if (hasSodium) sodium += sodiumArr[i] * s;
    }

    // Score: weighted accuracy across all objectives
    const carbAcc = targetCarbsG > 0
      ? Math.max(0, 1 - Math.abs(carbs - targetCarbsG) / targetCarbsG)
      : 1;

    let score;
    if (hasFluid && hasSodium) {
      const fluidAcc = Math.max(0, 1 - Math.abs(fluid - hydrationTargetMl) / hydrationTargetMl);
      const sodiumAcc = Math.max(0, 1 - Math.abs(sodium - sodiumTargetMg) / sodiumTargetMg);
      score = carbAcc * 0.50 + fluidAcc * 0.30 + sodiumAcc * 0.20;
    } else if (hasFluid) {
      const fluidAcc = Math.max(0, 1 - Math.abs(fluid - hydrationTargetMl) / hydrationTargetMl);
      score = carbAcc * 0.60 + fluidAcc * 0.40;
    } else {
      score = carbAcc;
    }

    if (score > bestScore) {
      bestScore = score;
      bestServings = [...servings];
    }

    // Increment indices (mixed-radix counter)
    let carry = true;
    for (let i = dimCount - 1; i >= 0 && carry; i--) {
      indices[i]++;
      if (indices[i] < dimensions[i].values.length) {
        carry = false;
      } else {
        indices[i] = 0;
      }
    }
    if (carry) break;
  }

  // Build result with best servings
  const scaledFoods = foods.map((f, i) => ({
    ...f,
    scaled_servings: bestServings[i],
    is_clamped: bestServings[i] <= f.min_servings + 0.01 || bestServings[i] >= f.max_servings - 0.01,
  }));

  return computeTotals(scaledFoods);
}

// ============================================================================
// ORIGINAL ALGORITHM (no scale groups — used as fallback)
// ============================================================================

function scaleTemplateOriginal(foods, targetCarbsG, hydrationTargetMl, sodiumTargetMg) {
  // Step 1: Generate all valid friendly-fraction values for each food
  const allValues = foods.map(f => {
    const unitCat = detectUnitCategory(f.serving_size);
    return generateFriendlyValues(f.min_servings, f.max_servings, unitCat);
  });

  // Step 2: Prune if search space is too large
  const MAX_SPACE = 500000;
  const MAX_PER_FOOD = 12;
  let searchValues = allValues;
  const totalSpace = allValues.reduce((p, v) => p * v.length, 1);

  if (totalSpace > MAX_SPACE) {
    const baseCarbs = foods.reduce((s, f) => s + f.carbs_g * f.default_servings, 0);
    const carbRatio = baseCarbs > 0 ? targetCarbsG / baseCarbs : 1;

    searchValues = allValues.map((vals, i) => {
      if (vals.length <= MAX_PER_FOOD) return vals;
      const f = foods[i];

      let ideal = f.default_servings * carbRatio;
      if (f.carbs_g <= 1 && (f.fluid_ml || 0) > 50 && hydrationTargetMl != null) {
        ideal = hydrationTargetMl / (f.fluid_ml || 1);
      } else if (f.carbs_g <= 1 && f.sodium_mg > 20 && sodiumTargetMg != null) {
        ideal = sodiumTargetMg / (f.sodium_mg || 1);
      }
      ideal = Math.max(f.min_servings, Math.min(f.max_servings, ideal));

      return [...vals]
        .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))
        .slice(0, MAX_PER_FOOD)
        .sort((a, b) => a - b);
    });
  }

  // Step 3: Grid search
  const n = foods.length;
  const indices = new Array(n).fill(0);
  let bestScore = -Infinity;
  let bestServings = foods.map(f => f.default_servings);

  const hasFluid = hydrationTargetMl != null && hydrationTargetMl > 0;
  const hasSodium = sodiumTargetMg != null && sodiumTargetMg > 0;

  const carbsArr = foods.map(f => f.carbs_g);
  const fluidArr = foods.map(f => f.fluid_ml || 0);
  const sodiumArr = foods.map(f => f.sodium_mg);

  while (true) {
    let carbs = 0, fluid = 0, sodium = 0;
    for (let i = 0; i < n; i++) {
      const s = searchValues[i][indices[i]];
      carbs += carbsArr[i] * s;
      if (hasFluid) fluid += fluidArr[i] * s;
      if (hasSodium) sodium += sodiumArr[i] * s;
    }

    const carbAcc = targetCarbsG > 0
      ? Math.max(0, 1 - Math.abs(carbs - targetCarbsG) / targetCarbsG)
      : 1;

    let score;
    if (hasFluid && hasSodium) {
      const fluidAcc = Math.max(0, 1 - Math.abs(fluid - hydrationTargetMl) / hydrationTargetMl);
      const sodiumAcc = Math.max(0, 1 - Math.abs(sodium - sodiumTargetMg) / sodiumTargetMg);
      score = carbAcc * 0.50 + fluidAcc * 0.30 + sodiumAcc * 0.20;
    } else if (hasFluid) {
      const fluidAcc = Math.max(0, 1 - Math.abs(fluid - hydrationTargetMl) / hydrationTargetMl);
      score = carbAcc * 0.60 + fluidAcc * 0.40;
    } else {
      score = carbAcc;
    }

    if (score > bestScore) {
      bestScore = score;
      bestServings = indices.map((idx, i) => searchValues[i][idx]);
    }

    let carry = true;
    for (let i = n - 1; i >= 0 && carry; i--) {
      indices[i]++;
      if (indices[i] < searchValues[i].length) {
        carry = false;
      } else {
        indices[i] = 0;
      }
    }
    if (carry) break;
  }

  const scaledFoods = foods.map((f, i) => ({
    ...f,
    scaled_servings: bestServings[i],
    is_clamped: bestServings[i] <= f.min_servings + 0.01 || bestServings[i] >= f.max_servings - 0.01,
  }));

  return computeTotals(scaledFoods);
}

// ============================================================================
// HELPERS
// ============================================================================

function computeTotals(scaledFoods) {
  const actualCarbs = scaledFoods.reduce((sum, f) => sum + (f.carbs_g * f.scaled_servings), 0);
  const actualProtein = scaledFoods.reduce((sum, f) => sum + (f.protein_g * f.scaled_servings), 0);
  const actualFat = scaledFoods.reduce((sum, f) => sum + (f.fat_g * f.scaled_servings), 0);
  const actualSodium = scaledFoods.reduce((sum, f) => sum + (f.sodium_mg * f.scaled_servings), 0);
  const actualFluid = scaledFoods.reduce((sum, f) => sum + ((f.fluid_ml || 0) * f.scaled_servings), 0);
  const actualCalories = scaledFoods.reduce((sum, f) => sum + ((f.calories || 0) * f.scaled_servings), 0);

  return {
    scaledFoods,
    actualCarbs: Math.round(actualCarbs * 10) / 10,
    actualProtein: Math.round(actualProtein * 10) / 10,
    actualFat: Math.round(actualFat * 10) / 10,
    actualSodium: Math.round(actualSodium * 10) / 10,
    actualFluid: Math.round(actualFluid * 10) / 10,
    actualCalories: Math.round(actualCalories),
  };
}

/**
 * Compute pre-workout carb target from v3 algorithm
 * @param {number} weightKg
 * @param {number} hoursBefore
 * @returns {number} target carbs in grams
 */
export function preWorkoutCarbTarget(weightKg, hoursBefore) {
  const carbPerKg = Math.max(0.5, Math.min(hoursBefore, 4.0));
  return Math.round(weightKg * carbPerKg);
}

/**
 * Detect scale groups in a foods array and return group info.
 * Useful for UI display.
 *
 * @param {Array} foods - JSONB foods array from template
 * @returns {{ groups: Map<string, {foods: Array, multiplierRange: [number, number]}>, hasGroups: boolean }}
 */
export function analyzeScaleGroups(foods) {
  const groupMap = new Map();

  for (const f of (foods || [])) {
    if (f.scale_group) {
      if (!groupMap.has(f.scale_group)) {
        groupMap.set(f.scale_group, { foods: [], minMult: 0, maxMult: Infinity });
      }
      const group = groupMap.get(f.scale_group);
      group.foods.push(f);
      if (f.default_servings > 0) {
        group.minMult = Math.max(group.minMult, f.min_servings / f.default_servings);
        group.maxMult = Math.min(group.maxMult, f.max_servings / f.default_servings);
      }
    }
  }

  return {
    groups: groupMap,
    hasGroups: groupMap.size > 0,
  };
}
