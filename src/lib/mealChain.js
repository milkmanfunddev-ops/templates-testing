/**
 * Meal Chain System — multi-phase pre-workout meal planning
 *
 * Uses existing macrosV3.js for macro calculations and scaling.js for template scaling.
 */

import { calculatePreWorkoutMacros } from './macrosV3.js';
import { scaleTemplate } from './scaling.js';
import { filterTemplates } from './dietFilter.js';

// ============================================================================
// PHASE SCHEDULE
// ============================================================================

export const PHASE_SCHEDULE = {
  '3-4 hours': [
    { role: 'full_meal', carbPct: 0.60, timingWindows: ['3-4 hours'], mealType: 'full_meal' },
    { role: 'snack',     carbPct: 0.25, timingWindows: ['1-2 hours'], mealType: 'snack' },
    { role: 'top_up',    carbPct: 0.15, timingWindows: ['< 30 min', '30-60 min'], mealType: 'top_up' },
  ],
  '1-2 hours': [
    { role: 'snack',  carbPct: 0.75, timingWindows: ['1-2 hours'], mealType: 'snack' },
    { role: 'top_up', carbPct: 0.25, timingWindows: ['< 30 min', '30-60 min'], mealType: 'top_up' },
  ],
  '30-60 min': [
    { role: 'top_up', carbPct: 1.0, timingWindows: ['30-60 min'], mealType: 'top_up' },
  ],
  '< 30 min': [
    { role: 'top_up', carbPct: 1.0, timingWindows: ['< 30 min'], mealType: 'top_up' },
  ],
};

const TIMING_TO_HOURS = {
  '3-4 hours': 3.0,
  '1-2 hours': 1.5,
  '30-60 min': 0.75,
  '< 30 min': 0.25,
};

const PHASE_HOURS = {
  'full_meal': 3.0,
  'snack': 1.5,
  'top_up': 0.25,
};

// ============================================================================
// TARGETS
// ============================================================================

/**
 * Get meal chain targets for all phases
 */
export function getMealChainTargets(weightKg, timingKey, sweatSodiumCat, envLabel) {
  const phases = PHASE_SCHEDULE[timingKey];
  if (!phases) return null;

  const hoursBefore = TIMING_TO_HOURS[timingKey];
  const totalCarbs = Math.round(weightKg * Math.max(0.5, Math.min(hoursBefore, 4.0)));

  // Build per-phase targets
  const phaseTargets = phases.map(phase => {
    const phaseHours = PHASE_HOURS[phase.mealType] || hoursBefore;
    const phaseMacros = calculatePreWorkoutMacros(weightKg, phaseHours, false, sweatSodiumCat, envLabel);
    return {
      ...phase,
      carbTarget: Math.round(totalCarbs * phase.carbPct),
      hydrationTarget: phaseMacros.hydration,
      sodiumTarget: phaseMacros.sodium,
    };
  });

  return {
    phases: phaseTargets,
    totalCarbs,
    totalHydration: phaseTargets.reduce((s, p) => s + p.hydrationTarget, 0),
    totalSodium: phaseTargets.reduce((s, p) => s + p.sodiumTarget, 0),
  };
}

// ============================================================================
// ELIGIBLE TEMPLATES PER PHASE
// ============================================================================

export function getEligibleTemplatesPerPhase(templates, profile, phases) {
  const filtered = filterTemplates(templates, profile);

  return phases.map(phase => {
    const candidates = filtered.filter(t => {
      const matchesTiming = phase.timingWindows.includes(t.timing_window);
      const matchesMealType = t.meal_type === phase.mealType;
      return matchesTiming || matchesMealType;
    });
    return { phase, candidates };
  });
}

// ============================================================================
// SCORING
// ============================================================================

function accuracyScore(actual, target) {
  if (target === 0) return actual === 0 ? 1 : 0;
  return Math.max(0, 1 - Math.abs(actual - target) / target);
}

export function scoreMealChain(chain, totalTargets) {
  const totalCarbs = chain.reduce((s, c) => s + c.scaled.actualCarbs, 0);
  const totalFluid = chain.reduce((s, c) => s + c.scaled.actualFluid, 0);
  const totalSodium = chain.reduce((s, c) => s + c.scaled.actualSodium, 0);

  const carbScore = accuracyScore(totalCarbs, totalTargets.totalCarbs);
  const hydrationScore = accuracyScore(totalFluid, totalTargets.totalHydration);
  const sodiumScore = accuracyScore(totalSodium, totalTargets.totalSodium);

  // Variety penalty: -0.1 per pair of phases sharing same base_category
  const cats = chain.map(c => c.template.base_category);
  let varietyPenalty = 0;
  for (let i = 0; i < cats.length; i++) {
    for (let j = i + 1; j < cats.length; j++) {
      if (cats[i] === cats[j]) varietyPenalty += 0.1;
    }
  }

  const score = carbScore * 0.4 + hydrationScore * 0.25 + sodiumScore * 0.25 + Math.max(0, 0.1 - varietyPenalty);
  return Math.max(0, Math.min(1, score));
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateMealChain(chain, targets, tolerances = { carbs: 0.10, hydration: 0.20, sodium: 0.25 }) {
  const totalCarbs = chain.reduce((s, c) => s + c.scaled.actualCarbs, 0);
  const totalFluid = chain.reduce((s, c) => s + c.scaled.actualFluid, 0);
  const totalSodium = chain.reduce((s, c) => s + c.scaled.actualSodium, 0);

  const carbPct = targets.totalCarbs > 0 ? Math.abs(totalCarbs - targets.totalCarbs) / targets.totalCarbs : 0;
  const hydPct = targets.totalHydration > 0 ? Math.abs(totalFluid - targets.totalHydration) / targets.totalHydration : 0;
  const sodPct = targets.totalSodium > 0 ? Math.abs(totalSodium - targets.totalSodium) / targets.totalSodium : 0;

  return {
    pass: carbPct <= tolerances.carbs && hydPct <= tolerances.hydration && sodPct <= tolerances.sodium,
    details: {
      carbs: { actual: Math.round(totalCarbs), target: targets.totalCarbs, pct: carbPct, pass: carbPct <= tolerances.carbs },
      hydration: { actual: Math.round(totalFluid), target: targets.totalHydration, pct: hydPct, pass: hydPct <= tolerances.hydration },
      sodium: { actual: Math.round(totalSodium), target: targets.totalSodium, pct: sodPct, pass: sodPct <= tolerances.sodium },
    },
  };
}

// ============================================================================
// COMBO FINDER
// ============================================================================

/**
 * Find the best meal chain combos for a given setup
 */
export function findBestCombos(templates, profile, weightKg, timingKey, sweatSodiumCat, envLabel, topN = 5) {
  const targets = getMealChainTargets(weightKg, timingKey, sweatSodiumCat, envLabel);
  if (!targets) return [];

  const phaseCandidates = getEligibleTemplatesPerPhase(templates, profile, targets.phases);

  // Check each phase has candidates
  if (phaseCandidates.some(pc => pc.candidates.length === 0)) return [];

  // Pre-filter: keep top 8 per phase (by carb proximity)
  const filtered = phaseCandidates.map(pc => {
    if (pc.candidates.length <= 8) return pc;
    const scored = pc.candidates.map(t => {
      const baseCarbs = (t.foods || []).reduce((s, f) => s + f.carbs_g * f.default_servings, 0);
      return { t, diff: Math.abs(baseCarbs - pc.phase.carbTarget) };
    });
    scored.sort((a, b) => a.diff - b.diff);
    return { ...pc, candidates: scored.slice(0, 8).map(s => s.t) };
  });

  // Pre-compute grid search scaling for each (template, phase) pair.
  // This avoids redundant grid searches when the same template appears
  // in multiple combos paired with different templates in other phases.
  const scalingCache = new Map();
  for (const { phase, candidates } of filtered) {
    for (const template of candidates) {
      const key = `${template.id}::${phase.role}`;
      if (!scalingCache.has(key)) {
        scalingCache.set(key, scaleTemplate(
          template.foods || [],
          phase.carbTarget,
          phase.hydrationTarget,
          phase.sodiumTarget
        ));
      }
    }
  }

  // Enumerate combos (cap at 1000)
  const combos = [];
  const MAX_COMBOS = 1000;

  function enumerate(phaseIdx, current) {
    if (combos.length >= MAX_COMBOS) return;
    if (phaseIdx >= filtered.length) {
      const chain = current.map(item => ({
        ...item,
        scaled: scalingCache.get(`${item.template.id}::${item.phase.role}`),
      }));
      const score = scoreMealChain(chain, targets);
      const validation = validateMealChain(chain, targets);
      combos.push({ chain, score, validation });
      return;
    }

    const { phase, candidates } = filtered[phaseIdx];
    for (const template of candidates) {
      if (combos.length >= MAX_COMBOS) return;
      enumerate(phaseIdx + 1, [...current, { phase, template }]);
    }
  }

  enumerate(0, []);

  // Sort by score descending, return top N
  combos.sort((a, b) => b.score - a.score);
  return combos.slice(0, topN);
}
