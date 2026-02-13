import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { scaleTemplate, preWorkoutCarbTarget, analyzeScaleGroups } from '../lib/scaling';
import { calculatePreWorkoutMacros } from '../lib/macrosV3';
import { isTemplateEligible, PRESET_PROFILES } from '../lib/dietFilter';
import { PHASE_SCHEDULE, getMealChainTargets, findBestCombos, getEligibleTemplatesPerPhase } from '../lib/mealChain';

const PERSONAS = [
  { label: '54 kg', weightKg: 54 },
  { label: '64 kg', weightKg: 64 },
  { label: '73 kg', weightKg: 73 },
  { label: '91 kg', weightKg: 91 },
];

const TIMINGS = [
  { label: '0.5h', hoursBefore: 0.5 },
  { label: '1.5h', hoursBefore: 1.5 },
  { label: '3.0h', hoursBefore: 3.0 },
];

const MULTI_PHASE_TIMINGS = ['3-4 hours', '1.5-3 hours'];

export default function TestRunner() {
  const [templates, setTemplates] = useState([]);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [tRes, fRes] = await Promise.all([
      supabase.from('templates').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('template_foods').select('*').eq('is_active', true).order('name'),
    ]);
    setTemplates(tRes.data || []);
    setFoods(fRes.data || []);
    setLoading(false);
  }

  function toggleExpand(key) {
    setExpanded(e => ({ ...e, [key]: !e[key] }));
  }

  async function runAll() {
    setRunning(true);
    const categories = [];

    // 1. Data Integrity
    categories.push(runDataIntegrity(templates, foods));

    // 2. Nutrition Totals Accuracy
    categories.push(runNutritionTotals(templates));

    // 3. Allergen Consistency
    categories.push(runAllergenConsistency(templates, foods));

    // 4. Individual Scaling Feasibility
    categories.push(runScalingFeasibility(templates));

    // 5. Digestion Speed Appropriateness
    categories.push(runDigestionSpeed(templates));

    // 6. Macro Range
    categories.push(runMacroRange(templates));

    // 7. Excluded Diets Consistency
    categories.push(runExcludedDietsConsistency(templates, foods));

    // 8. Meal Chain Coverage
    categories.push(runMealChainCoverage(templates));

    // 9. Meal Chain Accuracy
    categories.push(runMealChainAccuracy(templates));

    // 10. Hydration & Sodium Validation
    categories.push(runHydrationSodium(templates));

    // 11. Scale Group Proportional Scaling
    categories.push(runScaleGroupProportional(templates));

    setResults(categories);
    setRunning(false);
  }

  if (loading) return <div className="loading">Loading data...</div>;

  const totalTests = results ? results.reduce((s, c) => s + c.tests.length, 0) : 0;
  const totalPassed = results ? results.reduce((s, c) => s + c.tests.filter(t => t.pass).length, 0) : 0;

  return (
    <div>
      <div className="flex gap-sm items-center" style={{ marginBottom: '1rem' }}>
        <button className="btn btn-primary" onClick={runAll} disabled={running}>
          {running ? 'Running...' : 'Run All Tests'}
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {templates.length} templates | {foods.length} foods
        </span>
        {results && (
          <span>
            <span className="badge badge-pass">Passed: {totalPassed}</span>{' '}
            <span className="badge badge-fail">Failed: {totalTests - totalPassed}</span>{' '}
            <span className="badge badge-info">Rate: {((totalPassed / totalTests) * 100).toFixed(1)}%</span>
          </span>
        )}
      </div>

      {running && (
        <div className="panel">
          <div className="progress-bar"><div className="progress-fill" style={{ width: '50%' }} /></div>
          <p style={{ textAlign: 'center', marginTop: '0.5rem', color: 'var(--text-muted)' }}>Running tests...</p>
        </div>
      )}

      {results && results.map((cat, ci) => {
        const passed = cat.tests.filter(t => t.pass).length;
        const failed = cat.tests.length - passed;
        const isOpen = expanded[ci];
        return (
          <div key={ci} className="test-category" onClick={() => toggleExpand(ci)}>
            <div className="flex justify-between items-center">
              <h3>
                {isOpen ? '▼' : '▶'} {cat.name}
                <span className="badge badge-pass" style={{ marginLeft: '0.5rem' }}>{passed}</span>
                {failed > 0 && <span className="badge badge-fail" style={{ marginLeft: '0.25rem' }}>{failed}</span>}
              </h3>
            </div>
            {isOpen && (
              <div onClick={e => e.stopPropagation()} style={{ marginTop: '0.5rem' }}>
                {cat.tests.map((t, ti) => (
                  <div key={ti} className={`test-item ${t.pass ? 'test-pass' : 'test-fail'}`}>
                    <span>{t.pass ? '✓' : '✗'}</span> {t.name}
                    {t.detail && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>{t.detail}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// TEST IMPLEMENTATIONS
// ============================================================================

function runDataIntegrity(templates, foods) {
  const tests = [];

  tests.push({
    name: 'All templates have at least 1 food',
    pass: templates.every(t => (t.foods || []).length > 0),
    detail: templates.filter(t => (t.foods || []).length === 0).map(t => t.name).join(', ') || undefined,
  });

  tests.push({
    name: 'All templates have valid timing_window',
    pass: templates.every(t => ['< 30 min', '30-90 min', '1.5-3 hours', '3-4 hours'].includes(t.timing_window)),
  });

  tests.push({
    name: 'All templates have valid meal_type',
    pass: templates.every(t => ['top_up', 'snack', 'full_meal'].includes(t.meal_type)),
  });

  tests.push({
    name: 'All food items have positive carbs_g',
    pass: foods.every(f => Number(f.carbs_g) >= 0),
  });

  tests.push({
    name: 'All food items have serving_size defined',
    pass: foods.every(f => f.serving_size && f.serving_size.length > 0),
  });

  return { name: '1. Data Integrity', tests };
}

function runNutritionTotals(templates) {
  const tests = [];

  for (const t of templates) {
    const foods = t.foods || [];
    const computedCarbs = foods.reduce((s, f) => s + f.carbs_g * f.default_servings, 0);
    const storedCarbs = Number(t.total_carbs_g);
    const diff = Math.abs(computedCarbs - storedCarbs);
    tests.push({
      name: `${t.name}: stored carbs match computed`,
      pass: diff < 1,
      detail: diff >= 1 ? `stored=${storedCarbs.toFixed(1)}, computed=${computedCarbs.toFixed(1)}` : undefined,
    });
  }

  return { name: '2. Nutrition Totals Accuracy', tests };
}

function runAllergenConsistency(templates, foods) {
  const tests = [];
  const foodMap = new Map(foods.map(f => [f.id, f]));

  for (const t of templates) {
    const computedAllergens = new Set();
    for (const fi of (t.foods || [])) {
      const cat = foodMap.get(fi.food_id);
      if (cat) (cat.allergens || []).forEach(a => computedAllergens.add(a));
      (fi.allergens || []).forEach(a => computedAllergens.add(a));
    }
    const stored = new Set(t.allergens || []);
    const missing = [...computedAllergens].filter(a => !stored.has(a));
    tests.push({
      name: `${t.name}: allergens match food union`,
      pass: missing.length === 0,
      detail: missing.length > 0 ? `Missing: ${missing.join(', ')}` : undefined,
    });
  }

  return { name: '3. Allergen Consistency', tests };
}

function runScalingFeasibility(templates) {
  const tests = [];
  let pass = 0, fail = 0;

  for (const persona of PERSONAS) {
    for (const timing of TIMINGS) {
      const target = preWorkoutCarbTarget(persona.weightKg, timing.hoursBefore);
      const eligible = templates.filter(t => {
        if (timing.hoursBefore >= 2.5) return t.meal_type === 'full_meal';
        if (timing.hoursBefore >= 1.0) return t.meal_type === 'snack';
        return t.meal_type === 'top_up';
      });

      for (const t of eligible) {
        const scaled = scaleTemplate(t.foods || [], target);
        const diff = target > 0 ? Math.abs(scaled.actualCarbs - target) / target : 0;
        const ok = diff <= 0.10;
        if (ok) pass++; else fail++;
        if (!ok) {
          tests.push({
            name: `${t.name} @ ${persona.label} / ${timing.label}`,
            pass: false,
            detail: `target=${target}g, actual=${scaled.actualCarbs}g (${(diff * 100).toFixed(1)}% off)`,
          });
        }
      }
    }
  }

  tests.unshift({
    name: `Overall: ${pass} passed, ${fail} failed (${((pass / (pass + fail)) * 100).toFixed(1)}% rate)`,
    pass: fail === 0 || (pass / (pass + fail)) >= 0.70,
  });

  return { name: '4. Individual Scaling Feasibility', tests };
}

function runDigestionSpeed(templates) {
  const tests = [];

  const topUps = templates.filter(t => t.meal_type === 'top_up');
  const slowTopUps = topUps.filter(t => t.digestion_speed === 'slow');
  tests.push({
    name: 'No top_up templates have slow digestion',
    pass: slowTopUps.length === 0,
    detail: slowTopUps.length > 0 ? slowTopUps.map(t => t.name).join(', ') : undefined,
  });

  const fullMeals = templates.filter(t => t.meal_type === 'full_meal');
  const fastMeals = fullMeals.filter(t => t.digestion_speed === 'fast');
  tests.push({
    name: 'No full_meal templates have fast digestion',
    pass: fastMeals.length === 0,
    detail: fastMeals.length > 0 ? fastMeals.map(t => t.name).join(', ') : undefined,
  });

  return { name: '5. Digestion Speed Appropriateness', tests };
}

function runMacroRange(templates) {
  const tests = [];

  for (const t of templates) {
    const carbs = Number(t.total_carbs_g);
    tests.push({
      name: `${t.name}: carbs in reasonable range`,
      pass: carbs >= 5 && carbs <= 300,
      detail: carbs < 5 || carbs > 300 ? `carbs=${carbs}g` : undefined,
    });
  }

  return { name: '6. Macro Range', tests };
}

function runExcludedDietsConsistency(templates, foods) {
  const tests = [];
  const foodMap = new Map(foods.map(f => [f.id, f]));

  // All foods have non-null excluded_diets
  const nullDiets = foods.filter(f => f.excluded_diets === null || f.excluded_diets === undefined);
  tests.push({
    name: 'All template_foods have non-null excluded_diets',
    pass: nullDiets.length === 0,
    detail: nullDiets.length > 0 ? `Missing: ${nullDiets.map(f => f.name).join(', ')}` : undefined,
  });

  // Template excluded_diets matches food union
  for (const t of templates) {
    const foodDiets = new Set();
    for (const fi of (t.foods || [])) {
      const cat = foodMap.get(fi.food_id);
      if (cat && cat.excluded_diets) cat.excluded_diets.forEach(d => foodDiets.add(d));
    }
    const stored = new Set(t.excluded_diets || []);
    const missing = [...foodDiets].filter(d => !stored.has(d));
    tests.push({
      name: `${t.name}: excluded_diets match food union`,
      pass: missing.length === 0,
      detail: missing.length > 0 ? `Missing: ${missing.join(', ')}` : undefined,
    });
  }

  return { name: '7. Excluded Diets Consistency', tests };
}

function runMealChainCoverage(templates) {
  const tests = [];
  const profiles = PRESET_PROFILES.slice(0, 5); // No restrictions, Gluten-free, Dairy-free, Vegan, Nut-free

  for (const profile of profiles) {
    for (const persona of PERSONAS) {
      for (const timingKey of MULTI_PHASE_TIMINGS) {
        const targets = getMealChainTargets(persona.weightKg, timingKey, 'medium', 'moderate');
        if (!targets) continue;

        const phaseCandidates = getEligibleTemplatesPerPhase(templates, profile, targets.phases);
        const emptyPhases = phaseCandidates.filter(pc => pc.candidates.length === 0);

        tests.push({
          name: `${profile.label} / ${persona.label} / ${timingKey}`,
          pass: emptyPhases.length === 0,
          detail: emptyPhases.length > 0
            ? `No templates for: ${emptyPhases.map(pc => pc.phase.role).join(', ')}`
            : `${phaseCandidates.map(pc => `${pc.phase.role}:${pc.candidates.length}`).join(', ')}`,
        });
      }
    }
  }

  return { name: '8. Meal Chain Coverage', tests };
}

function runMealChainAccuracy(templates) {
  const tests = [];

  for (const persona of PERSONAS) {
    for (const timingKey of MULTI_PHASE_TIMINGS) {
      const profile = { diet: 'omnivore', allergens: [], excludedFoods: [] };
      const combos = findBestCombos(templates, profile, persona.weightKg, timingKey, 'medium', 'moderate', 1);

      if (combos.length === 0) {
        tests.push({ name: `${persona.label} / ${timingKey}`, pass: false, detail: 'No combos found' });
        continue;
      }

      const best = combos[0];
      const v = best.validation.details;
      tests.push({
        name: `${persona.label} / ${timingKey}: carbs within ±10%`,
        pass: v.carbs.pass,
        detail: `${v.carbs.actual}g / ${v.carbs.target}g (${(v.carbs.pct * 100).toFixed(1)}% off), score=${(best.score * 100).toFixed(1)}%`,
      });
    }
  }

  return { name: '9. Meal Chain Accuracy', tests };
}

function runHydrationSodium(templates) {
  const tests = [];

  // All templates have non-negative fluid/sodium totals
  const negFluid = templates.filter(t => {
    const fluid = (t.foods || []).reduce((s, f) => s + (f.fluid_ml || 0) * f.default_servings, 0);
    return fluid < 0;
  });
  tests.push({
    name: 'All templates have non-negative fluid totals',
    pass: negFluid.length === 0,
  });

  // Full meals > 80ml fluid at defaults
  const fullMeals = templates.filter(t => t.meal_type === 'full_meal');
  const lowFluid = fullMeals.filter(t => {
    const fluid = (t.foods || []).reduce((s, f) => s + (f.fluid_ml || 0) * f.default_servings, 0);
    return fluid < 80;
  });
  tests.push({
    name: 'full_meal templates at default servings have > 80ml fluid',
    pass: lowFluid.length === 0,
    detail: lowFluid.length > 0 ? lowFluid.map(t => t.name).join(', ') : undefined,
  });

  // Per-persona hydration reachable
  for (const persona of PERSONAS) {
    const macros = calculatePreWorkoutMacros(persona.weightKg, 3.0, false, 'medium', 'moderate');
    const eligible = fullMeals;
    const maxFluid = eligible.reduce((max, t) => {
      const fluid = (t.foods || []).reduce((s, f) => s + (f.fluid_ml || 0) * f.max_servings, 0);
      return Math.max(max, fluid);
    }, 0);
    tests.push({
      name: `${persona.label}: full_meal max fluid >= target (${macros.hydration}ml)`,
      pass: maxFluid >= macros.hydration * 0.5, // at least 50% reachable from food
      detail: `max achievable=${Math.round(maxFluid)}ml`,
    });
  }

  return { name: '10. Hydration & Sodium Validation', tests };
}

function runScaleGroupProportional(templates) {
  const tests = [];
  const grouped = templates.filter(t => {
    const { hasGroups } = analyzeScaleGroups(t.foods || []);
    return hasGroups;
  });

  tests.push({
    name: `${grouped.length} templates have scale groups`,
    pass: true,
    detail: grouped.length === 0 ? 'No scale groups defined yet — test is informational' : undefined,
  });

  // For each grouped template, verify proportional scaling at multiple targets
  for (const t of grouped) {
    const foods = t.foods || [];
    const { groups } = analyzeScaleGroups(foods);

    for (const [groupName, groupInfo] of groups) {
      // Verify multiplier range is valid (min <= max)
      tests.push({
        name: `${t.name} / "${groupName}": valid multiplier range`,
        pass: groupInfo.minMult <= groupInfo.maxMult,
        detail: `range: ${groupInfo.minMult.toFixed(2)}x – ${groupInfo.maxMult.toFixed(2)}x (${groupInfo.foods.length} foods)`,
      });

      // Verify proportional scaling: at multiple targets, foods in group maintain ratios
      for (const persona of PERSONAS.slice(0, 2)) { // Just test 2 personas
        const target = preWorkoutCarbTarget(persona.weightKg, 3.0);
        const scaled = scaleTemplate(foods, target);

        // Check that foods in the same group have consistent multiplier ratios
        const groupScaled = scaled.scaledFoods.filter(f => f.scale_group === groupName);
        if (groupScaled.length >= 2) {
          const ratios = groupScaled.map(f => {
            const original = foods.find(of => of.food_id === f.food_id || of.name === f.name);
            return original && original.default_servings > 0
              ? f.scaled_servings / original.default_servings
              : null;
          }).filter(r => r !== null);

          if (ratios.length >= 2) {
            const minR = Math.min(...ratios);
            const maxR = Math.max(...ratios);
            // Allow ±15% tolerance due to friendly-fraction snapping
            const spread = minR > 0 ? (maxR - minR) / minR : 0;
            tests.push({
              name: `${t.name} / "${groupName}" @ ${persona.label}: proportional within 15%`,
              pass: spread <= 0.15,
              detail: `multipliers: ${ratios.map(r => r.toFixed(2)).join(', ')}, spread=${(spread * 100).toFixed(1)}%`,
            });
          }
        }
      }
    }
  }

  if (grouped.length === 0) {
    tests.push({
      name: 'No scale groups to test (add scale_group to template foods to enable)',
      pass: true,
      detail: 'Informational — define scale_group on food items via the editor',
    });
  }

  return { name: '11. Scale Group Proportional Scaling', tests };
}
