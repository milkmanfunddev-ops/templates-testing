import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function FoodsCatalog() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => { loadFoods(); }, []);

  async function loadFoods() {
    setLoading(true);
    const { data, error } = await supabase
      .from('template_foods')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (!error) setFoods(data || []);
    setLoading(false);
  }

  function handleSort(col) {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  }

  const sorted = [...foods].sort((a, b) => {
    const va = a[sortBy], vb = b[sortBy];
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : (va || 0) - (vb || 0);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  async function handleSave(food) {
    if (food.id) {
      await supabase.from('template_foods').update(food).eq('id', food.id);
    } else {
      await supabase.from('template_foods').insert(food);
    }
    setEditing(null);
    loadFoods();
  }

  async function handleDelete(id) {
    if (!confirm('Soft-delete this food?')) return;
    await supabase.from('template_foods').update({ is_active: false }).eq('id', id);
    loadFoods();
  }

  if (loading) return <div className="loading">Loading foods...</div>;

  const cols = [
    { key: 'display_name', label: 'Name' },
    { key: 'serving_size', label: 'Serving' },
    { key: 'calories', label: 'Cal' },
    { key: 'carbs_g', label: 'Carbs' },
    { key: 'protein_g', label: 'Protein' },
    { key: 'fat_g', label: 'Fat' },
    { key: 'fiber_g', label: 'Fiber' },
    { key: 'sodium_mg', label: 'Na (mg)' },
    { key: 'fluid_ml', label: 'Fluid' },
    { key: 'digestion_speed', label: 'Speed' },
  ];

  return (
    <div>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={() => setEditing({
          name: '', display_name: '', serving_size: '', serving_weight_g: 0,
          calories: 0, carbs_g: 0, protein_g: 0, fat_g: 0, fiber_g: 0,
          sodium_mg: 0, fluid_ml: 0, allergens: [], digestion_speed: 'medium',
          excluded_diets: [], product_type: 'real_food', is_electrolyte: false,
          caffeine_mg: 0, requires_preparation: false,
        })}>
          + Add Food
        </button>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {foods.length} foods
        </span>
      </div>

      <table>
        <thead>
          <tr>
            {cols.map(c => (
              <th key={c.key} onClick={() => handleSort(c.key)} style={{ cursor: 'pointer' }}>
                {c.label} {sortBy === c.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
              </th>
            ))}
            <th>Type</th>
            <th>Allergens</th>
            <th>Excluded Diets</th>
            <th>Flags</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(f => (
            <tr key={f.id}>
              <td><strong>{f.display_name}</strong></td>
              <td>{f.serving_size}</td>
              <td>{f.calories}</td>
              <td>{Number(f.carbs_g).toFixed(1)}</td>
              <td>{Number(f.protein_g).toFixed(1)}</td>
              <td>{Number(f.fat_g).toFixed(1)}</td>
              <td>{Number(f.fiber_g || 0).toFixed(1)}</td>
              <td>{Number(f.sodium_mg).toFixed(0)}</td>
              <td>{Number(f.fluid_ml || 0).toFixed(0)}</td>
              <td><span className="badge badge-info">{f.digestion_speed}</span></td>
              <td><span className="badge badge-info">{f.product_type || '-'}</span></td>
              <td>{(f.allergens || []).join(', ') || '-'}</td>
              <td>
                {(f.excluded_diets || []).map(d => (
                  <span key={d} className="badge badge-warn" style={{ marginRight: '0.15rem', fontSize: '0.65rem' }}>{d}</span>
                ))}
                {(!f.excluded_diets || f.excluded_diets.length === 0) && '-'}
              </td>
              <td>
                <div className="flex gap-sm flex-wrap">
                  {f.is_electrolyte && <span className="badge badge-info">electrolyte</span>}
                  {Number(f.caffeine_mg || 0) > 0 && <span className="badge badge-warn">caffeine</span>}
                  {f.requires_preparation && <span className="badge badge-info">prep</span>}
                </div>
              </td>
              <td>
                <div className="flex gap-sm">
                  <button className="btn btn-sm" onClick={() => setEditing({ ...f })}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(f.id)}>Del</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editing.id ? 'Edit Food' : 'Add Food'}</h2>
            <FoodForm food={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

const PRODUCT_TYPES = ['real_food', 'bar', 'gel', 'chew', 'sports_drink', 'supplement', 'condiment', 'beverage'];
const DIET_OPTIONS = ['vegan', 'vegetarian', 'paleo', 'keto', 'low_carb'];

function FoodForm({ food, onSave, onCancel }) {
  const [form, setForm] = useState(food);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function toggleDiet(diet) {
    const diets = form.excluded_diets || [];
    const has = diets.includes(diet);
    set('excluded_diets', has ? diets.filter(d => d !== diet) : [...diets, diet]);
  }

  return (
    <div>
      <div className="grid grid-2 gap-md" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Name (machine)</label>
          <input style={{ width: '100%' }} value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div>
          <label>Display Name</label>
          <input style={{ width: '100%' }} value={form.display_name} onChange={e => set('display_name', e.target.value)} />
        </div>
        <div>
          <label>Serving Size</label>
          <input style={{ width: '100%' }} value={form.serving_size} onChange={e => set('serving_size', e.target.value)} />
        </div>
        <div>
          <label>Serving Weight (g)</label>
          <input type="number" style={{ width: '100%' }} value={form.serving_weight_g} onChange={e => set('serving_weight_g', +e.target.value)} />
        </div>
      </div>

      <div className="grid grid-4 gap-md" style={{ marginBottom: '1rem' }}>
        {['calories', 'carbs_g', 'protein_g', 'fat_g', 'fiber_g', 'sodium_mg', 'fluid_ml', 'caffeine_mg'].map(key => (
          <div key={key}>
            <label>{key}</label>
            <input type="number" step="0.1" style={{ width: '100%' }} value={form[key] || 0} onChange={e => set(key, +e.target.value)} />
          </div>
        ))}
      </div>

      <div className="grid grid-3 gap-md" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Digestion Speed</label>
          <select style={{ width: '100%' }} value={form.digestion_speed} onChange={e => set('digestion_speed', e.target.value)}>
            <option value="fast">Fast</option>
            <option value="medium">Medium</option>
            <option value="slow">Slow</option>
          </select>
        </div>
        <div>
          <label>Product Type</label>
          <select style={{ width: '100%' }} value={form.product_type || 'real_food'} onChange={e => set('product_type', e.target.value)}>
            {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label>Flags</label>
          <label className="allergen-check">
            <input type="checkbox" checked={!!form.is_electrolyte} onChange={e => set('is_electrolyte', e.target.checked)} />
            Electrolyte
          </label>
          <label className="allergen-check">
            <input type="checkbox" checked={!!form.requires_preparation} onChange={e => set('requires_preparation', e.target.checked)} />
            Requires Prep
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Allergens (comma-separated)</label>
        <input style={{ width: '100%' }} value={(form.allergens || []).join(', ')}
          onChange={e => set('allergens', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Excluded Diets</label>
        <div className="flex gap-sm flex-wrap">
          {DIET_OPTIONS.map(d => (
            <label key={d} className="allergen-check">
              <input type="checkbox" checked={(form.excluded_diets || []).includes(d)} onChange={() => toggleDiet(d)} />
              {d}
            </label>
          ))}
        </div>
      </div>

      <div className="flex gap-sm">
        <button className="btn btn-primary" onClick={() => onSave(form)}>Save</button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
