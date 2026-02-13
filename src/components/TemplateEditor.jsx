import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const TIMING_OPTIONS = ['< 30 min', '30-90 min', '1.5-3 hours', '3-4 hours'];
const MEAL_TYPE_OPTIONS = ['top_up', 'snack', 'full_meal'];
const DIGESTION_OPTIONS = ['fast', 'medium', 'slow'];

export default function TemplateEditor({ template, onSave, onCancel }) {
  const isNew = !template?.id;
  const [foodCatalog, setFoodCatalog] = useState([]);
  const [form, setForm] = useState({
    name: '',
    timing_window: '1.5-3 hours',
    meal_type: 'snack',
    base_category: '',
    digestion_speed: 'medium',
    notes: '',
    foods: [],
    ...template,
  });

  useEffect(() => {
    loadFoodCatalog();
  }, []);

  async function loadFoodCatalog() {
    const { data } = await supabase
      .from('template_foods')
      .select('*')
      .eq('is_active', true)
      .order('display_name');
    setFoodCatalog(data || []);
  }

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  function addFood(foodId) {
    const catalogFood = foodCatalog.find(f => f.id === foodId);
    if (!catalogFood) return;

    const newFoodItem = {
      food_id: catalogFood.id,
      name: catalogFood.name,
      display_name: catalogFood.display_name,
      serving_size: catalogFood.serving_size,
      carbs_g: Number(catalogFood.carbs_g),
      protein_g: Number(catalogFood.protein_g),
      fat_g: Number(catalogFood.fat_g),
      sodium_mg: Number(catalogFood.sodium_mg),
      fluid_ml: Number(catalogFood.fluid_ml || 0),
      calories: Number(catalogFood.calories || 0),
      allergens: catalogFood.allergens || [],
      digestion_speed: catalogFood.digestion_speed || 'medium',
      default_servings: 1,
      min_servings: 0.25,
      max_servings: 4,
      scale_group: null,
    };
    set('foods', [...form.foods, newFoodItem]);
  }

  function updateFood(index, key, val) {
    const updated = [...form.foods];
    updated[index] = { ...updated[index], [key]: val };
    set('foods', updated);
  }

  function removeFood(index) {
    set('foods', form.foods.filter((_, i) => i !== index));
  }

  // Compute totals
  const totalCarbs = form.foods.reduce((s, f) => s + f.carbs_g * f.default_servings, 0);
  const totalProtein = form.foods.reduce((s, f) => s + f.protein_g * f.default_servings, 0);
  const totalFat = form.foods.reduce((s, f) => s + f.fat_g * f.default_servings, 0);
  const totalSodium = form.foods.reduce((s, f) => s + f.sodium_mg * f.default_servings, 0);
  const totalFluid = form.foods.reduce((s, f) => s + (f.fluid_ml || 0) * f.default_servings, 0);
  const totalCalories = form.foods.reduce((s, f) => s + (f.calories || 0) * f.default_servings, 0);

  // Compute unique scale groups for color-coding
  const scaleGroupNames = [...new Set(form.foods.map(f => f.scale_group).filter(Boolean))];
  const GROUP_COLORS = ['#e8d5f5', '#d5e8f5', '#f5e8d5', '#d5f5e8', '#f5d5d5', '#f5f5d5'];

  // Compute allergens and excluded_diets union
  const allAllergens = [...new Set(form.foods.flatMap(f => f.allergens || []))];
  const allExcludedDiets = [...new Set(
    form.foods.flatMap(f => {
      const cat = foodCatalog.find(c => c.id === f.food_id);
      return cat?.excluded_diets || [];
    })
  )];

  async function handleSave() {
    const payload = {
      name: form.name,
      slug: form.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      timing_window: form.timing_window,
      meal_type: form.meal_type,
      base_category: form.base_category,
      digestion_speed: form.digestion_speed,
      notes: form.notes,
      foods: form.foods,
      allergens: allAllergens,
      excluded_diets: allExcludedDiets,
      total_carbs_g: Math.round(totalCarbs * 10) / 10,
      total_protein_g: Math.round(totalProtein * 10) / 10,
      total_fat_g: Math.round(totalFat * 10) / 10,
      total_sodium_mg: Math.round(totalSodium),
      total_fluid_ml: Math.round(totalFluid),
      total_calories: Math.round(totalCalories),
    };

    if (isNew) {
      payload.sort_order = 999;
      payload.is_active = true;
      payload.validation_status = 'draft';
    }

    if (form.id) {
      await supabase.from('templates').update(payload).eq('id', form.id);
    } else {
      await supabase.from('templates').insert(payload);
    }

    onSave();
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
          <h2>{isNew ? 'New Template' : `Edit: ${form.name}`}</h2>
          <button className="btn btn-sm" onClick={onCancel}>Close</button>
        </div>

        {/* Meta fields */}
        <div className="grid grid-3 gap-md" style={{ marginBottom: '1rem' }}>
          <div>
            <label>Name</label>
            <input style={{ width: '100%' }} value={form.name} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label>Timing Window</label>
            <select style={{ width: '100%' }} value={form.timing_window} onChange={e => set('timing_window', e.target.value)}>
              {TIMING_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label>Meal Type</label>
            <select style={{ width: '100%' }} value={form.meal_type} onChange={e => set('meal_type', e.target.value)}>
              {MEAL_TYPE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label>Base Category</label>
            <input style={{ width: '100%' }} value={form.base_category || ''} onChange={e => set('base_category', e.target.value)} />
          </div>
          <div>
            <label>Digestion Speed</label>
            <select style={{ width: '100%' }} value={form.digestion_speed} onChange={e => set('digestion_speed', e.target.value)}>
              {DIGESTION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label>Notes</label>
            <input style={{ width: '100%' }} value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        {/* Auto-computed badges */}
        <div className="flex gap-sm flex-wrap" style={{ marginBottom: '1rem' }}>
          <span className="badge badge-info">Carbs: {totalCarbs.toFixed(1)}g</span>
          <span className="badge badge-info">Protein: {totalProtein.toFixed(1)}g</span>
          <span className="badge badge-info">Fat: {totalFat.toFixed(1)}g</span>
          <span className="badge badge-info">Na: {totalSodium.toFixed(0)}mg</span>
          <span className="badge badge-info">Fluid: {totalFluid.toFixed(0)}ml</span>
          <span className="badge badge-info">Cal: {totalCalories}</span>
          {allAllergens.length > 0 && (
            <span className="badge badge-warn">Allergens: {allAllergens.join(', ')}</span>
          )}
          {allExcludedDiets.length > 0 && (
            <span className="badge badge-warn">Excludes: {allExcludedDiets.join(', ')}</span>
          )}
        </div>

        {/* Foods table */}
        <h3>Foods ({form.foods.length})</h3>
        <table style={{ marginBottom: '0.5rem' }}>
          <thead>
            <tr>
              <th>Food</th>
              <th>Serving</th>
              <th>Default</th>
              <th>Min</th>
              <th>Max</th>
              <th>Carbs/srv</th>
              <th>Na/srv</th>
              <th>Fluid/srv</th>
              <th>Scale Group</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {form.foods.map((f, i) => {
              const groupIdx = f.scale_group ? scaleGroupNames.indexOf(f.scale_group) : -1;
              const rowBg = groupIdx >= 0 ? GROUP_COLORS[groupIdx % GROUP_COLORS.length] : undefined;
              return (
              <tr key={i} style={rowBg ? { backgroundColor: rowBg } : undefined}>
                <td><strong>{f.display_name}</strong></td>
                <td>{f.serving_size}</td>
                <td>
                  <input type="number" step="0.25" style={{ width: '60px' }}
                    value={f.default_servings} onChange={e => updateFood(i, 'default_servings', +e.target.value)} />
                </td>
                <td>
                  <input type="number" step="0.25" style={{ width: '60px' }}
                    value={f.min_servings} onChange={e => updateFood(i, 'min_servings', +e.target.value)} />
                </td>
                <td>
                  <input type="number" step="0.25" style={{ width: '60px' }}
                    value={f.max_servings} onChange={e => updateFood(i, 'max_servings', +e.target.value)} />
                </td>
                <td>{f.carbs_g}g</td>
                <td>{f.sodium_mg}mg</td>
                <td>{f.fluid_ml || 0}ml</td>
                <td>
                  <input style={{ width: '80px', fontSize: '0.75rem' }}
                    value={f.scale_group || ''}
                    placeholder="none"
                    onChange={e => updateFood(i, 'scale_group', e.target.value || null)} />
                </td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => removeFood(i)}>×</button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>

        {/* Add food dropdown */}
        <div className="flex gap-sm" style={{ marginBottom: '1rem' }}>
          <select onChange={e => { if (e.target.value) { addFood(e.target.value); e.target.value = ''; } }}>
            <option value="">+ Add food from catalog...</option>
            {foodCatalog.map(f => (
              <option key={f.id} value={f.id}>{f.display_name} ({f.carbs_g}g carbs, {f.sodium_mg}mg Na)</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-sm">
          <button className="btn btn-primary" onClick={handleSave}>Save Template</button>
          <button className="btn" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
