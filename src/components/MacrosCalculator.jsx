import { useState } from 'react';
import { calculateMacrosV3 } from '../lib/macrosV3';

const DEFAULTS = {
  weight: 73,
  weight_unit: 'kg',
  hours_before: 1.5,
  is_fasted: false,
  activity_type: 'running',
  run_distance: 10,
  run_distance_unit: 'mi',
  run_pace: 9,
  run_pace_unit: 'min/mi',
  distance_miles: 25,
  speed_mph: 18,
  terrain: 'flat',
  distance_meters: 1500,
  pace_per_100m_seconds: 120,
  pool_or_open_water: 'pool',
  water_temp_c: 26,
  gut_training: 'moderate',
  sweat_rate_category: 'medium',
  sweat_sodium: 'medium',
  temp_c: null,
  humidity_pct: null,
};

export default function MacrosCalculator() {
  const [input, setInput] = useState(DEFAULTS);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function set(key, val) { setInput(i => ({ ...i, [key]: val })); }

  function calculate() {
    try {
      setError(null);
      const r = calculateMacrosV3(input);
      setResult(r);
    } catch (e) {
      setError(e.message);
      setResult(null);
    }
  }

  return (
    <div>
      <div className="panel">
        <h2>Input Parameters</h2>

        <div className="grid grid-4 gap-md" style={{ marginBottom: '1rem' }}>
          <div>
            <label>Weight</label>
            <input type="number" style={{ width: '100%' }} value={input.weight} onChange={e => set('weight', +e.target.value)} />
          </div>
          <div>
            <label>Unit</label>
            <select style={{ width: '100%' }} value={input.weight_unit} onChange={e => set('weight_unit', e.target.value)}>
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </div>
          <div>
            <label>Hours Before</label>
            <input type="number" step="0.5" style={{ width: '100%' }} value={input.hours_before} onChange={e => set('hours_before', +e.target.value)} />
          </div>
          <div>
            <label>Fasted?</label>
            <select style={{ width: '100%' }} value={input.is_fasted ? 'yes' : 'no'} onChange={e => set('is_fasted', e.target.value === 'yes')}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label>Activity Type</label>
          <select value={input.activity_type} onChange={e => set('activity_type', e.target.value)}>
            <option value="running">Running</option>
            <option value="cycling">Cycling</option>
            <option value="swimming">Swimming</option>
          </select>
        </div>

        {input.activity_type === 'running' && (
          <div className="grid grid-4 gap-md" style={{ marginBottom: '1rem' }}>
            <div>
              <label>Distance</label>
              <input type="number" step="0.1" style={{ width: '100%' }} value={input.run_distance} onChange={e => set('run_distance', +e.target.value)} />
            </div>
            <div>
              <label>Distance Unit</label>
              <select style={{ width: '100%' }} value={input.run_distance_unit} onChange={e => set('run_distance_unit', e.target.value)}>
                <option value="mi">miles</option>
                <option value="km">km</option>
              </select>
            </div>
            <div>
              <label>Pace (min/mi)</label>
              <input type="number" step="0.1" style={{ width: '100%' }} value={input.run_pace} onChange={e => set('run_pace', +e.target.value)} />
            </div>
            <div></div>
          </div>
        )}

        {input.activity_type === 'cycling' && (
          <div className="grid grid-4 gap-md" style={{ marginBottom: '1rem' }}>
            <div>
              <label>Distance (mi)</label>
              <input type="number" step="0.1" style={{ width: '100%' }} value={input.distance_miles} onChange={e => set('distance_miles', +e.target.value)} />
            </div>
            <div>
              <label>Speed (mph)</label>
              <input type="number" step="0.1" style={{ width: '100%' }} value={input.speed_mph} onChange={e => set('speed_mph', +e.target.value)} />
            </div>
            <div>
              <label>Terrain</label>
              <select style={{ width: '100%' }} value={input.terrain} onChange={e => set('terrain', e.target.value)}>
                <option value="flat">Flat</option>
                <option value="rolling">Rolling</option>
                <option value="hilly">Hilly</option>
              </select>
            </div>
            <div></div>
          </div>
        )}

        {input.activity_type === 'swimming' && (
          <div className="grid grid-4 gap-md" style={{ marginBottom: '1rem' }}>
            <div>
              <label>Distance (m)</label>
              <input type="number" style={{ width: '100%' }} value={input.distance_meters} onChange={e => set('distance_meters', +e.target.value)} />
            </div>
            <div>
              <label>Pace (sec/100m)</label>
              <input type="number" style={{ width: '100%' }} value={input.pace_per_100m_seconds} onChange={e => set('pace_per_100m_seconds', +e.target.value)} />
            </div>
            <div>
              <label>Pool/Open</label>
              <select style={{ width: '100%' }} value={input.pool_or_open_water} onChange={e => set('pool_or_open_water', e.target.value)}>
                <option value="pool">Pool</option>
                <option value="open_water">Open Water</option>
              </select>
            </div>
            <div>
              <label>Water Temp (C)</label>
              <input type="number" style={{ width: '100%' }} value={input.water_temp_c} onChange={e => set('water_temp_c', +e.target.value)} />
            </div>
          </div>
        )}

        <div className="grid grid-4 gap-md" style={{ marginBottom: '1rem' }}>
          <div>
            <label>Gut Training</label>
            <select style={{ width: '100%' }} value={input.gut_training} onChange={e => set('gut_training', e.target.value)}>
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label>Sweat Rate</label>
            <select style={{ width: '100%' }} value={input.sweat_rate_category} onChange={e => set('sweat_rate_category', e.target.value)}>
              <option value="light">Light</option>
              <option value="medium">Medium</option>
              <option value="heavy">Heavy</option>
            </select>
          </div>
          <div>
            <label>Sweat Sodium</label>
            <select style={{ width: '100%' }} value={input.sweat_sodium} onChange={e => set('sweat_sodium', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div></div>
        </div>

        <div className="grid grid-4 gap-md" style={{ marginBottom: '1rem' }}>
          <div>
            <label>Temp (C) - optional</label>
            <input type="number" style={{ width: '100%' }} value={input.temp_c ?? ''} placeholder="auto"
              onChange={e => set('temp_c', e.target.value === '' ? null : +e.target.value)} />
          </div>
          <div>
            <label>Humidity (%) - optional</label>
            <input type="number" style={{ width: '100%' }} value={input.humidity_pct ?? ''} placeholder="auto"
              onChange={e => set('humidity_pct', e.target.value === '' ? null : +e.target.value)} />
          </div>
          <div></div>
          <div></div>
        </div>

        <button className="btn btn-primary" onClick={calculate}>Calculate Macros</button>
      </div>

      {error && <div className="panel" style={{ color: 'var(--fail)' }}>Error: {error}</div>}

      {result && (
        <div>
          <div className="panel">
            <div className="flex gap-md items-center" style={{ marginBottom: '1rem' }}>
              <span className="badge badge-info">{result.algorithm_version}</span>
              <span>Duration: {result.duration_min.toFixed(0)} min ({result.duration_h.toFixed(2)}h)</span>
              <span>MET: {result.MET}</span>
              <span>Env: {result.environment_label}</span>
              <span>Gross: {result.calories_gross_kcal} kcal</span>
              <span>Net: {result.calories_net_kcal} kcal</span>
            </div>
          </div>

          <div className="grid grid-3 gap-md">
            <div className="panel">
              <h3>Pre-Workout ({result.pre.meal_type})</h3>
              <div className="grid grid-2 gap-sm">
                <MacroItem label="Carbs" value={`${result.pre.carbs_g}g`} />
                <MacroItem label="Protein" value={`${result.pre.protein_g}g`} />
                <MacroItem label="Fat" value={`${result.pre.fat_g}g`} />
                <MacroItem label="Sodium" value={`${result.pre.sodium_mg}mg`} />
                <MacroItem label="Hydration" value={`${result.pre.hydration_ml}ml`} />
              </div>
            </div>

            <div className="panel">
              <h3>During Workout</h3>
              <div className="grid grid-2 gap-sm">
                <MacroItem label="Carb Rate" value={`${result.during.carb_rate_gph} g/h`} />
                <MacroItem label="Total Carbs" value={`${result.during.total_carbs_g}g`} />
                <MacroItem label="Hydration Rate" value={`${result.during.hydration_rate_mlph} ml/h`} />
                <MacroItem label="Total Hydration" value={`${result.during.total_hydration_ml}ml`} />
                <MacroItem label="Na Rate" value={`${result.during.sodium_rate_mgph} mg/h`} />
                <MacroItem label="Total Na" value={`${result.during.total_sodium_mg}mg`} />
                <MacroItem label="Band" value={`${result.during.band_low}-${result.during.band_high} g/h`} />
              </div>
            </div>

            <div className="panel">
              <h3>Post-Workout</h3>
              <div className="grid grid-2 gap-sm">
                <MacroItem label="Carbs" value={`${result.post.carbs_g}g`} />
                <MacroItem label="Protein" value={`${result.post.protein_g}g`} />
                <MacroItem label="Fat" value={`${result.post.fat_g}g`} />
                <MacroItem label="Sodium" value={`${result.post.sodium_mg}mg`} />
                <MacroItem label="Hydration" value={`${result.post.hydration_ml}ml`} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MacroItem({ label, value }) {
  return (
    <div>
      <div className="macro-label">{label}</div>
      <div className="macro-value">{value}</div>
    </div>
  );
}
