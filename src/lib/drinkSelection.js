/**
 * Per-Phase Drink Selection for Pre-Workout Templates
 *
 * Each phase (full_meal, snack, top_up) gets a food template + drink paired together.
 * Drinks are selected per-phase from a timing-appropriate drink pool to fill
 * sodium/fluid gaps left by the food template.
 */

// ============================================================================
// DRINK POOL
// ============================================================================

/**
 * Beverages with nutrition data, phase validity, and serving limits.
 * Nutrition values are per single serving.
 *
 * Categories:
 *   plain      — zero/low-calorie hydration (water, coffee)
 *   breakfast   — common morning beverages (juice, milk, smoothie)
 *   alt_milk    — plant-based milks (oat, almond, coconut water)
 *   hydration   — water + electrolyte combinations
 *   carb_drink  — generic carb-containing training drinks
 */
export const DRINK_POOL = [
  // ── Plain / Zero-Cal ──────────────────────────────────────────────
  {
    id: 'water',
    name: 'Water',
    category: 'plain',
    carbs_g: 0, sodium_mg: 0, fluid_ml: 240,
    validPhases: ['full_meal', 'snack', 'top_up'],
    maxServings: 8,
    serving_size: 'cup',
  },
  {
    id: 'coffee',
    name: 'Coffee',
    category: 'plain',
    carbs_g: 0, sodium_mg: 5, fluid_ml: 237,
    validPhases: ['full_meal'],
    maxServings: 2,
    serving_size: 'cup',
  },

  // ── Breakfast Beverages ───────────────────────────────────────────
  {
    id: 'orange_juice',
    name: 'Orange Juice',
    category: 'breakfast',
    carbs_g: 26, sodium_mg: 2, fluid_ml: 240,
    validPhases: ['full_meal', 'snack'],
    maxServings: 3,
    serving_size: 'cup',
  },
  {
    id: 'chocolate_milk',
    name: 'Chocolate Milk',
    category: 'breakfast',
    carbs_g: 26, sodium_mg: 150, fluid_ml: 240,
    validPhases: ['full_meal'],
    maxServings: 2,
    serving_size: 'cup',
    allergens: ['dairy'],
  },
  {
    id: 'whole_milk',
    name: 'Milk (whole)',
    category: 'breakfast',
    carbs_g: 12, sodium_mg: 105, fluid_ml: 240,
    validPhases: ['full_meal'],
    maxServings: 2,
    serving_size: 'cup',
    allergens: ['dairy'],
  },
  {
    id: 'fruit_smoothie',
    name: 'Fruit Smoothie',
    category: 'breakfast',
    carbs_g: 27, sodium_mg: 20, fluid_ml: 240,
    validPhases: ['full_meal'],
    maxServings: 2,
    serving_size: 'cup',
  },

  // ── Alt Milks ─────────────────────────────────────────────────────
  {
    id: 'oat_milk',
    name: 'Oat Milk',
    category: 'alt_milk',
    carbs_g: 16, sodium_mg: 100, fluid_ml: 240,
    validPhases: ['full_meal'],
    maxServings: 2,
    serving_size: 'cup',
    allergens: ['gluten'],
  },
  {
    id: 'almond_milk',
    name: 'Almond Milk (unsweetened)',
    category: 'alt_milk',
    carbs_g: 4, sodium_mg: 170, fluid_ml: 240,
    validPhases: ['full_meal'],
    maxServings: 2,
    serving_size: 'cup',
    allergens: ['tree_nuts'],
  },
  {
    id: 'coconut_water',
    name: 'Coconut Water',
    category: 'alt_milk',
    carbs_g: 11, sodium_mg: 65, fluid_ml: 240,
    validPhases: ['snack', 'top_up'],
    maxServings: 3,
    serving_size: 'cup',
  },

  // ── Hydration (water + electrolytes) ──────────────────────────────
  {
    id: 'water_with_electrolytes',
    name: 'Water with Electrolytes',
    category: 'hydration',
    carbs_g: 4, sodium_mg: 300, fluid_ml: 500,
    validPhases: ['snack', 'top_up'],
    maxServings: 3,
    serving_size: 'bottle',
  },

  // ── Carb Drinks ───────────────────────────────────────────────────
  {
    id: 'sports_drink',
    name: 'Sports Drink',
    category: 'carb_drink',
    carbs_g: 21, sodium_mg: 250, fluid_ml: 355,
    validPhases: ['snack', 'top_up'],
    maxServings: 3,
    serving_size: 'cup',
  },
  {
    id: 'carb_drink_mix',
    name: 'Carb Drink Mix',
    category: 'carb_drink',
    carbs_g: 40, sodium_mg: 200, fluid_ml: 500,
    validPhases: ['snack', 'top_up'],
    maxServings: 2,
    serving_size: 'scoop',
  },
];

// ============================================================================
// BUDGET SPLITS
// ============================================================================

/** Estimated drink carbs per phase for pre-cache food target reduction */
export const AVG_DRINK_CARBS_PER_PHASE = {
  full_meal: 10,
  snack: 15,
  top_up: 5,
};

// ============================================================================
// BEVERAGE DETECTION & STRIPPING
// ============================================================================

/** Names of beverages that should be stripped from food templates */
const BEVERAGE_NAMES = new Set([
  'water', 'coffee', 'orange juice', 'oj', 'milk', 'whole milk',
  'chocolate milk', 'smoothie', 'fruit smoothie', 'sports drink',
  'electrolyte mix', 'electrolyte drink', 'juice', 'apple juice',
  'latte', 'tea', 'green tea', 'oat milk', 'almond milk',
  'coconut water', 'carb drink mix', 'water with electrolytes',
]);

/**
 * Check if a food item is a beverage (should be handled by drink pool instead)
 */
export function isBeverage(food) {
  const name = (food.display_name || food.name || '').toLowerCase().trim();
  if (BEVERAGE_NAMES.has(name)) return true;
  // Also match partial patterns
  if (/\b(juice|milk|smoothie|coffee|tea|latte|sports drink|electrolyte|carb drink)\b/i.test(name)) return true;
  return false;
}

/**
 * Strip beverages from a food array so drinks come from the drink pool instead.
 * Returns a new array without beverage items.
 */
export function stripBeveragesFromFoods(foods) {
  if (!foods || foods.length === 0) return foods;
  const stripped = foods.filter(f => !isBeverage(f));
  // Don't strip if it would leave no foods
  return stripped.length > 0 ? stripped : foods;
}

// ============================================================================
// ELIGIBILITY FILTERING
// ============================================================================

/**
 * Get drinks eligible for a specific phase, filtering by allergens.
 * @param {string} phase - 'full_meal', 'snack', or 'top_up'
 * @param {Object} profile - User profile with { allergens: [] }
 * @returns {Array} Eligible drinks
 */
export function getEligibleDrinksForPhase(phase, profile) {
  const userAllergens = new Set(profile?.allergens || []);

  return DRINK_POOL.filter(drink => {
    // Phase validity
    if (!drink.validPhases.includes(phase)) return false;
    // Allergen check
    if (drink.allergens) {
      for (const a of drink.allergens) {
        if (userAllergens.has(a)) return false;
      }
    }
    return true;
  });
}

// ============================================================================
// DRINK SELECTION ALGORITHM
// ============================================================================

/**
 * Select the best drink for a phase based on sodium/fluid gaps left by food.
 *
 * Algorithm:
 * 1. Calculate food's sodium/fluid contribution from scaled template
 * 2. Calculate gaps: sodiumGap = target - foodSodium, fluidGap = target - foodFluid
 * 3. If both gaps negligible (<10mg Na, <50ml fluid) -> return null
 * 4. Filter eligible drinks by phase + allergens
 * 5. For each candidate: calculate optimal servings, snap to 0.5, score
 * 6. Select randomly from top 3 (variety)
 *
 * @param {string} phase - 'full_meal', 'snack', or 'top_up'
 * @param {Object} scaledFoodResult - Result from scaleTemplate()
 * @param {number} sodiumTarget - Phase sodium target in mg
 * @param {number} fluidTarget - Phase fluid target in ml
 * @param {number} carbTarget - Phase carb target in g (for carb fit scoring)
 * @param {Object} profile - User profile for allergen filtering
 * @returns {Object|null} Selected drink with servings, or null if not needed
 */
export function selectDrinkForPhase(phase, scaledFoodResult, sodiumTarget, fluidTarget, carbTarget, profile) {
  const foodSodium = scaledFoodResult.actualSodium;
  const foodFluid = scaledFoodResult.actualFluid;
  const foodCarbs = scaledFoodResult.actualCarbs;

  const sodiumGap = Math.max(0, sodiumTarget - foodSodium);
  const fluidGap = Math.max(0, fluidTarget - foodFluid);

  // If both gaps are negligible, no drink needed
  if (sodiumGap < 10 && fluidGap < 50) return null;

  const eligible = getEligibleDrinksForPhase(phase, profile);
  if (eligible.length === 0) return null;

  // Remaining carb budget for drink
  const carbBudget = Math.max(0, carbTarget - foodCarbs);

  const scored = eligible.map(drink => {
    // Calculate optimal servings to fill gaps
    let idealServings = 0;

    if (drink.fluid_ml > 0 && fluidGap > 0) {
      idealServings = Math.max(idealServings, fluidGap / drink.fluid_ml);
    }
    if (drink.sodium_mg > 0 && sodiumGap > 0) {
      idealServings = Math.max(idealServings, sodiumGap / drink.sodium_mg);
    }

    // Clamp to max and snap to friendly increments
    // Cups can be halved; bottles/scoops/packets snap to whole numbers
    idealServings = Math.min(idealServings, drink.maxServings);
    const wholeOnly = ['bottle', 'packet', 'scoop', 'tablet'].includes(drink.serving_size);
    const servings = wholeOnly
      ? Math.max(1, Math.round(idealServings))
      : Math.max(0.5, Math.round(idealServings * 2) / 2);
    const finalServings = Math.min(servings, drink.maxServings);

    // Calculate what this drink provides
    const drinkSodium = drink.sodium_mg * finalServings;
    const drinkFluid = drink.fluid_ml * finalServings;
    const drinkCarbs = drink.carbs_g * finalServings;

    // Score: Na fill (50%) + fluid fill (40%) + carb fit (10%)
    const naFill = sodiumGap > 0 ? Math.min(1, drinkSodium / sodiumGap) : 1;
    const fluidFill = fluidGap > 0 ? Math.min(1, drinkFluid / fluidGap) : 1;

    // Carb fit: penalize overshoot, reward staying within budget
    let carbFit = 1;
    if (carbBudget > 0) {
      carbFit = drinkCarbs <= carbBudget ? 1 : Math.max(0, 1 - (drinkCarbs - carbBudget) / carbBudget);
    } else {
      // No carb budget left - prefer low-carb drinks
      carbFit = drinkCarbs === 0 ? 1 : Math.max(0, 1 - drinkCarbs / 30);
    }

    const score = naFill * 0.50 + fluidFill * 0.40 + carbFit * 0.10;

    return { drink, servings: finalServings, score, drinkSodium, drinkFluid, drinkCarbs };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Select randomly from top 3 for variety
  const topN = scored.slice(0, Math.min(3, scored.length));
  const selected = topN[Math.floor(Math.random() * topN.length)];

  if (selected.servings <= 0) return null;

  return {
    drink: selected.drink,
    servings: selected.servings,
    carbs: selected.drinkCarbs,
    sodium: selected.drinkSodium,
    fluid: selected.drinkFluid,
  };
}
