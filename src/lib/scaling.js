/**
 * Template Scaling Algorithm — Grid Search Over Friendly Fractions
 *
 * Instead of scaling proportionally and rounding, we enumerate all valid
 * combinations of friendly-fraction servings and pick the one that best
 * satisfies carb, hydration, and sodium targets simultaneously.
 *
 * Algorithm:
 * 1. For each food, generate all valid serving values as friendly fractions
 * 2. Enumerate all combinations (prune if search space > 500K)
 * 3. Score each combination: carbs(50%) + hydration(30%) + sodium(20%)
 * 4. Return the best combination
 *
 * No food classification needed — every food's contribution to all three
 * objectives is considered simultaneously.
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
// GRID SEARCH SCALING
// ============================================================================

/**
 * Scale a template's foods using grid search over friendly fractions.
 *
 * Finds the combination of serving sizes that best satisfies all three
 * targets simultaneously, with every value being a natural friendly fraction.
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
    // Estimate ideal servings per food for intelligent pruning
    const baseCarbs = foods.reduce((s, f) => s + f.carbs_g * f.default_servings, 0);
    const carbRatio = baseCarbs > 0 ? targetCarbsG / baseCarbs : 1;

    searchValues = allValues.map((vals, i) => {
      if (vals.length <= MAX_PER_FOOD) return vals;
      const f = foods[i];

      // Estimate ideal serving based on the food's primary contribution
      let ideal = f.default_servings * carbRatio;
      if (f.carbs_g <= 1 && (f.fluid_ml || 0) > 50 && hydrationTargetMl != null) {
        // Fluid-primary food: estimate from hydration target
        ideal = hydrationTargetMl / (f.fluid_ml || 1);
      } else if (f.carbs_g <= 1 && f.sodium_mg > 20 && sodiumTargetMg != null) {
        // Sodium-primary food: estimate from sodium target
        ideal = sodiumTargetMg / (f.sodium_mg || 1);
      }
      ideal = Math.max(f.min_servings, Math.min(f.max_servings, ideal));

      // Keep the values closest to the ideal
      return [...vals]
        .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))
        .slice(0, MAX_PER_FOOD)
        .sort((a, b) => a - b);
    });
  }

  // Step 3: Grid search — find the combination that best hits all targets
  const n = foods.length;
  const indices = new Array(n).fill(0);
  let bestScore = -Infinity;
  let bestServings = foods.map(f => f.default_servings);

  const hasFluid = hydrationTargetMl != null && hydrationTargetMl > 0;
  const hasSodium = sodiumTargetMg != null && sodiumTargetMg > 0;

  // Pre-extract nutrition arrays for tight inner loop
  const carbsArr = foods.map(f => f.carbs_g);
  const fluidArr = foods.map(f => f.fluid_ml || 0);
  const sodiumArr = foods.map(f => f.sodium_mg);

  while (true) {
    // Compute macros for this combination
    let carbs = 0, fluid = 0, sodium = 0;
    for (let i = 0; i < n; i++) {
      const s = searchValues[i][indices[i]];
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
      bestServings = indices.map((idx, i) => searchValues[i][idx]);
    }

    // Increment indices (mixed-radix counter)
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

  // Step 4: Build result with best servings
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
