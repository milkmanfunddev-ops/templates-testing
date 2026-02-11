/**
 * Diet/Allergen/Preference Filtering for Templates
 */

export const DIETARY_PREFERENCES = [
  'omnivore', 'vegetarian', 'pescatarian', 'vegan',
  'mediterranean', 'paleo', 'keto', 'low_carb',
];

export const ALLERGENS = [
  'dairy', 'eggs', 'fish', 'gluten', 'peanuts',
  'sesame', 'shellfish', 'soy', 'tree_nuts',
];

// Diet → implied allergen exclusions
const DIET_ALLERGEN_MAP = {
  vegan: ['dairy', 'eggs', 'fish', 'shellfish'],
  vegetarian: ['fish', 'shellfish'],
  pescatarian: [],
  paleo: ['dairy', 'gluten', 'soy'],
  keto: [],
  low_carb: [],
  mediterranean: [],
  omnivore: [],
};

export const PRESET_PROFILES = [
  { label: 'No restrictions', diet: 'omnivore', allergens: [], excludedFoods: [] },
  { label: 'Gluten-free', diet: 'omnivore', allergens: ['gluten'], excludedFoods: [] },
  { label: 'Dairy-free', diet: 'omnivore', allergens: ['dairy'], excludedFoods: [] },
  { label: 'Vegan', diet: 'vegan', allergens: [], excludedFoods: [] },
  { label: 'Nut-free', diet: 'omnivore', allergens: ['peanuts', 'tree_nuts'], excludedFoods: [] },
  { label: 'Paleo', diet: 'paleo', allergens: [], excludedFoods: [] },
];

export function getDefaultProfile() {
  return { diet: 'omnivore', allergens: [], excludedFoods: [] };
}

/**
 * Check if a template is eligible given a user profile
 * @returns {{ eligible: boolean, reasons: string[] }}
 */
export function isTemplateEligible(template, profile) {
  const reasons = [];

  // 1. Check diet → excluded_diets on template
  if (profile.diet && profile.diet !== 'omnivore') {
    const templateDiets = template.excluded_diets || [];
    if (templateDiets.includes(profile.diet)) {
      reasons.push(`Excluded by ${profile.diet} diet`);
    }
  }

  // 2. Check diet-implied allergens
  const dietAllergens = DIET_ALLERGEN_MAP[profile.diet] || [];
  const templateAllergens = template.allergens || [];
  for (const a of dietAllergens) {
    if (templateAllergens.includes(a)) {
      reasons.push(`Contains ${a} (excluded by ${profile.diet} diet)`);
    }
  }

  // 3. Check explicit allergens
  for (const a of (profile.allergens || [])) {
    if (templateAllergens.includes(a) && !reasons.some(r => r.includes(a))) {
      reasons.push(`Contains allergen: ${a}`);
    }
  }

  // 4. Check excluded foods
  const foods = template.foods || [];
  for (const foodName of (profile.excludedFoods || [])) {
    const match = foods.find(f =>
      (f.display_name || '').toLowerCase() === foodName.toLowerCase() ||
      (f.name || '').toLowerCase() === foodName.toLowerCase()
    );
    if (match) {
      reasons.push(`Contains excluded food: ${match.display_name || match.name}`);
    }
  }

  return { eligible: reasons.length === 0, reasons };
}

/**
 * Filter templates by user profile
 */
export function filterTemplates(templates, profile) {
  if (!profile || (profile.diet === 'omnivore' && !profile.allergens?.length && !profile.excludedFoods?.length)) {
    return templates;
  }
  return templates.filter(t => isTemplateEligible(t, profile).eligible);
}
