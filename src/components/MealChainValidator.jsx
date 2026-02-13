import { useState, useMemo } from 'react';
import UserProfile from './UserProfile';
import { getDefaultProfile } from '../lib/dietFilter';
import {
  PHASE_SCHEDULE,
  getMealChainTargets,
  findBestCombos,
} from '../lib/mealChain';
import { formatFriendlyQuantity } from '../lib/scaling';

const PERSONAS = [
  { label: '54 kg', weightKg: 54 },
  { label: '64 kg', weightKg: 64 },
  { label: '73 kg', weightKg: 73 },
  { label: '91 kg', weightKg: 91 },
];

const TIMING_KEYS = ['3-4 hours', '1.5-3 hours', '30-90 min', '< 30 min'];
const SWEAT_SODIUM_CATS = ['low', 'medium', 'high'];
const ENV_LABELS = ['cool', 'temperate', 'moderate', 'warm', 'hot', 'very_hot'];

export default function MealChainValidator({ templates, foods, profile: externalProfile, onProfileChange: externalOnProfileChange }) {
  const [profile, setProfile] = useState(externalProfile || getDefaultProfile());
  const [persona, setPersona] = useState(PERSONAS[2]);
  const [timingKey, setTimingKey] = useState('3-4 hours');
  const [sweatSodium, setSweatSodium] = useState('medium');
  const [envLabel, setEnvLabel] = useState('moderate');
  const [combos, setCombos] = useState(null);
  const [expandedCombo, setExpandedCombo] = useState(null);

  const handleProfileChange = (p) => {
    setProfile(p);
    if (externalOnProfileChange) externalOnProfileChange(p);
  };

  const chainTargets = useMemo(
    () => getMealChainTargets(persona.weightKg, timingKey, sweatSodium, envLabel),
    [persona, timingKey, sweatSodium, envLabel]
  );

  const handleFindCombos = () => {
    const results = findBestCombos(
      templates, profile, persona.weightKg, timingKey,
      sweatSodium, envLabel, 5
    );
    setCombos(results);
    setExpandedCombo(null);
  };

  return (
    <div>
      <h2 style={{ marginBottom: '0.75rem' }}>Meal Chain Validator</h2>

      <div className="panel">
        <UserProfile profile={profile} onProfileChange={handleProfileChange} foods={foods} />

        <div className="grid grid-4 gap-md" style={{ marginTop: '0.75rem' }}>
          <div>
            <label>Persona:</label>
            <select style={{ width: '100%' }}
              value={persona.weightKg}
              onChange={e => setPersona(PERSONAS.find(p => p.weightKg === Number(e.target.value)))}
            >
              {PERSONAS.map(p => <option key={p.weightKg} value={p.weightKg}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label>Timing:</label>
            <select style={{ width: '100%' }} value={timingKey} onChange={e => setTimingKey(e.target.value)}>
              {TIMING_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label>Sweat Na:</label>
            <select style={{ width: '100%' }} value={sweatSodium} onChange={e => setSweatSodium(e.target.value)}>
              {SWEAT_SODIUM_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label>Environment:</label>
            <select style={{ width: '100%' }} value={envLabel} onChange={e => setEnvLabel(e.target.value)}>
              {ENV_LABELS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        <button className="btn btn-primary" style={{ marginTop: '0.75rem' }} onClick={handleFindCombos}>
          Find Best Combos
        </button>
      </div>

      {/* Phase schedule diagram */}
      {chainTargets && (
        <div className="panel" style={{ marginTop: '1rem' }}>
          <h4>Phase Schedule: {timingKey}</h4>
          <div className="phase-diagram">
            {chainTargets.phases.map((phase, i) => (
              <div
                key={i}
                className={`phase-bar phase-${phase.role}`}
                style={{ flex: phase.carbPct }}
              >
                <div className="phase-label">{phase.role}</div>
                <div className="phase-pct">{Math.round(phase.carbPct * 100)}%</div>
                <div className="phase-carbs">{phase.carbTarget}g carbs</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            Total targets: <strong>{chainTargets.totalCarbs}g</strong> carbs
            | <strong style={{ color: 'var(--accent)' }}>{chainTargets.totalHydration}ml</strong> fluid
            | <strong style={{ color: 'var(--warn)' }}>{chainTargets.totalSodium}mg</strong> sodium
          </div>
        </div>
      )}

      {/* Results */}
      {combos !== null && (
        <div style={{ marginTop: '1rem' }}>
          {combos.length === 0 ? (
            <div className="panel" style={{ color: 'var(--fail)' }}>
              No valid meal chains found. Try relaxing diet restrictions or check template coverage for this timing window.
            </div>
          ) : (
            <>
              <h3 style={{ marginBottom: '0.5rem' }}>Top {combos.length} Combos</h3>
              {combos.map((combo, idx) => {
                const isExpanded = expandedCombo === idx;
                const totalCarbs = combo.chain.reduce((s, c) => s + c.scaled.actualCarbs + (c.drink ? c.drink.carbs : 0), 0);
                const totalFluid = combo.chain.reduce((s, c) => s + c.scaled.actualFluid + (c.drink ? c.drink.fluid : 0), 0);
                const totalSodium = combo.chain.reduce((s, c) => s + c.scaled.actualSodium + (c.drink ? c.drink.sodium : 0), 0);
                const v = combo.validation.details;

                return (
                  <div key={idx} className="combo-card" onClick={() => setExpandedCombo(isExpanded ? null : idx)}>
                    {/* Header badges */}
                    <div className="flex gap-sm items-center flex-wrap">
                      <span style={{ fontWeight: 700 }}>#{idx + 1}</span>
                      <span className="badge badge-info">Score: {(combo.score * 100).toFixed(1)}%</span>
                      <span className={`badge ${v.carbs.pass ? 'badge-pass' : 'badge-fail'}`}>
                        Carbs: {Math.round(totalCarbs)}g / {chainTargets.totalCarbs}g
                      </span>
                      <span className={`badge ${v.hydration.pass ? 'badge-pass' : 'badge-fail'}`}>
                        Fluid: {Math.round(totalFluid)}ml / {chainTargets.totalHydration}ml
                      </span>
                      <span className={`badge ${v.sodium.pass ? 'badge-pass' : 'badge-fail'}`}>
                        Na: {Math.round(totalSodium)}mg / {chainTargets.totalSodium}mg
                      </span>
                    </div>

                    {/* Per-phase summary with food quantities + drink */}
                    <div style={{ marginTop: '0.5rem' }}>
                      {combo.chain.map((item, pi) => {
                        const phaseCarbs = item.scaled.actualCarbs + (item.drink ? item.drink.carbs : 0);
                        return (
                          <div key={pi} className={`combo-phase phase-${item.phase.role}`}>
                            <div className="flex justify-between items-center">
                              <div>
                                <strong>{item.phase.role}:</strong> {item.template.name}
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                                  ({Math.round(phaseCarbs)}g / {item.phase.carbTarget}g carbs)
                                </span>
                              </div>
                            </div>
                            {/* Inline food quantities */}
                            <div className="combo-foods-inline">
                              {item.scaled.scaledFoods.map((sf, fi) => (
                                <span key={fi} className="food-qty">
                                  {formatFriendlyQuantity(sf.scaled_servings)} {sf.serving_size} {sf.display_name}
                                  <span className="food-qty-macros">
                                    ({(sf.carbs_g * sf.scaled_servings).toFixed(0)}g carb, {((sf.fluid_ml || 0) * sf.scaled_servings).toFixed(0)}ml, {(sf.sodium_mg * sf.scaled_servings).toFixed(0)}mg Na)
                                  </span>
                                </span>
                              ))}
                            </div>
                            {/* Drink line */}
                            {item.drink && (
                              <div style={{
                                borderLeft: '3px solid var(--accent)',
                                paddingLeft: '0.5rem',
                                marginTop: '0.25rem',
                                fontSize: '0.8rem',
                              }}>
                                <span style={{ fontWeight: 600 }}>+ {item.drink.servings} {item.drink.drink.serving_size} {item.drink.drink.name}</span>
                                <span className="food-qty-macros" style={{ marginLeft: '0.5rem' }}>
                                  ({Math.round(item.drink.carbs)}g carb, {Math.round(item.drink.fluid)}ml, {Math.round(item.drink.sodium)}mg Na)
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Variety indicator */}
                    {(() => {
                      const cats = combo.chain.map(c => c.template.base_category);
                      const dupes = cats.filter((c, i) => cats.indexOf(c) !== i);
                      return dupes.length > 0 ? (
                        <div style={{ fontSize: '0.75rem', color: 'var(--warn)', marginTop: '0.25rem' }}>
                          Shared categories: {[...new Set(dupes)].join(', ')}
                        </div>
                      ) : null;
                    })()}

                    {/* Expanded detail -- full table with all macros */}
                    {isExpanded && (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: '0.75rem' }}>
                        {combo.chain.map((item, pi) => {
                          const phaseFluid = item.scaled.scaledFoods.reduce((s, f) => s + (f.fluid_ml || 0) * f.scaled_servings, 0)
                            + (item.drink ? item.drink.fluid : 0);
                          const phaseSodium = item.scaled.scaledFoods.reduce((s, f) => s + f.sodium_mg * f.scaled_servings, 0)
                            + (item.drink ? item.drink.sodium : 0);
                          const phaseCarbs = item.scaled.actualCarbs + (item.drink ? item.drink.carbs : 0);
                          return (
                            <div key={pi} style={{ marginBottom: '0.75rem' }}>
                              <h5>
                                {item.phase.role}: {item.template.name}
                                <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                  Totals: {Math.round(phaseCarbs)}g carbs | {Math.round(phaseFluid)}ml fluid | {Math.round(phaseSodium)}mg Na
                                </span>
                              </h5>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Food</th>
                                    <th>Scaled Qty</th>
                                    <th>Default</th>
                                    <th>Min</th>
                                    <th>Max</th>
                                    <th>Carbs</th>
                                    <th>Protein</th>
                                    <th>Fat</th>
                                    <th>Fluid</th>
                                    <th>Sodium</th>
                                    <th>Cal</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.scaled.scaledFoods.map((sf, fi) => {
                                    const atMin = sf.scaled_servings <= sf.min_servings;
                                    const atMax = sf.scaled_servings >= sf.max_servings;
                                    return (
                                      <tr key={fi}>
                                        <td>{sf.display_name}</td>
                                        <td>
                                          <strong style={{ color: atMin ? 'var(--warn)' : atMax ? 'var(--fail)' : 'inherit' }}>
                                            {formatFriendlyQuantity(sf.scaled_servings)}
                                          </strong>
                                          {' '}{sf.serving_size}
                                          {atMin && <span className="badge badge-warn" style={{ marginLeft: '0.25rem' }}>min</span>}
                                          {atMax && <span className="badge badge-fail" style={{ marginLeft: '0.25rem' }}>max</span>}
                                        </td>
                                        <td>{sf.default_servings}</td>
                                        <td>{sf.min_servings}</td>
                                        <td>{sf.max_servings}</td>
                                        <td>{(sf.carbs_g * sf.scaled_servings).toFixed(1)}g</td>
                                        <td>{(sf.protein_g * sf.scaled_servings).toFixed(1)}g</td>
                                        <td>{(sf.fat_g * sf.scaled_servings).toFixed(1)}g</td>
                                        <td>{((sf.fluid_ml || 0) * sf.scaled_servings).toFixed(0)}ml</td>
                                        <td>{(sf.sodium_mg * sf.scaled_servings).toFixed(0)}mg</td>
                                        <td>{((sf.calories || 0) * sf.scaled_servings).toFixed(0)}</td>
                                      </tr>
                                    );
                                  })}
                                  {/* Drink row */}
                                  {item.drink && (
                                    <tr style={{ backgroundColor: 'rgba(var(--accent-rgb, 0, 150, 136), 0.08)' }}>
                                      <td><strong>+ {item.drink.drink.name}</strong></td>
                                      <td><strong>{item.drink.servings}</strong> {item.drink.drink.serving_size}</td>
                                      <td>-</td>
                                      <td>-</td>
                                      <td>{item.drink.drink.maxServings}</td>
                                      <td>{item.drink.carbs.toFixed(1)}g</td>
                                      <td>-</td>
                                      <td>-</td>
                                      <td>{Math.round(item.drink.fluid)}ml</td>
                                      <td>{Math.round(item.drink.sodium)}mg</td>
                                      <td>-</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
