import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import TemplateEditor from './TemplateEditor';

const TIMING_FILTERS = ['All', '< 30 min', '30-90 min', '1.5-3 hours', '3-4 hours'];

export default function TemplateList() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (!error) setTemplates(data || []);
    setLoading(false);
  }

  const filtered = filter === 'All' ? templates : templates.filter(t => t.timing_window === filter);

  async function handleDelete(id) {
    if (!confirm('Soft-delete this template?')) return;
    await supabase.from('templates').update({ is_active: false }).eq('id', id);
    loadTemplates();
  }

  async function handleDuplicate(template) {
    const { id, created_at, updated_at, ...rest } = template;
    rest.name = rest.name + ' (copy)';
    rest.slug = rest.slug + '-copy-' + Date.now();
    await supabase.from('templates').insert(rest);
    loadTemplates();
  }

  if (loading) return <div className="loading">Loading templates...</div>;

  return (
    <div>
      <div className="toolbar">
        <div className="filter-chips">
          {TIMING_FILTERS.map(f => (
            <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginLeft: '0.5rem' }} onClick={() => setEditing({})}>
          + New Template
        </button>
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {filtered.length} templates
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Timing</th>
            <th>Type</th>
            <th>Carbs</th>
            <th>Protein</th>
            <th>Fat</th>
            <th>Na</th>
            <th>Fluid</th>
            <th>Cal</th>
            <th>Allergens</th>
            <th>Excluded Diets</th>
            <th>Category</th>
            <th>Speed</th>
            <th>Foods</th>
            <th>Groups</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t, i) => (
            <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(t)}>
              <td>{t.sort_order}</td>
              <td><strong>{t.name}</strong></td>
              <td>{t.timing_window}</td>
              <td><span className="badge badge-info">{t.meal_type}</span></td>
              <td>{Number(t.total_carbs_g).toFixed(0)}g</td>
              <td>{Number(t.total_protein_g).toFixed(0)}g</td>
              <td>{Number(t.total_fat_g).toFixed(0)}g</td>
              <td>{Number(t.total_sodium_mg || 0).toFixed(0)}mg</td>
              <td>{Number(t.total_fluid_ml || 0).toFixed(0)}ml</td>
              <td>{t.total_calories}</td>
              <td>
                {(t.allergens || []).length > 0
                  ? (t.allergens || []).map(a => (
                      <span key={a} className="badge badge-fail" style={{ marginRight: '0.15rem', fontSize: '0.6rem' }}>{a}</span>
                    ))
                  : <span style={{ color: 'var(--text-muted)' }}>none</span>
                }
              </td>
              <td>
                {(t.excluded_diets || []).length > 0
                  ? (t.excluded_diets || []).map(d => (
                      <span key={d} className="badge badge-warn" style={{ marginRight: '0.15rem', fontSize: '0.6rem' }}>{d}</span>
                    ))
                  : <span style={{ color: 'var(--text-muted)' }}>-</span>
                }
              </td>
              <td style={{ fontSize: '0.75rem' }}>{t.base_category || '-'}</td>
              <td><span className="badge badge-info">{t.digestion_speed || '-'}</span></td>
              <td>{(t.foods || []).length}</td>
              <td style={{ fontSize: '0.65rem' }}>
                {(() => {
                  const grps = [...new Set((t.foods || []).map(f => f.scale_group).filter(Boolean))];
                  return grps.length > 0
                    ? grps.map(g => <span key={g} className="badge badge-info" style={{ marginRight: '0.1rem', fontSize: '0.55rem' }}>{g}</span>)
                    : <span style={{ color: 'var(--text-muted)' }}>-</span>;
                })()}
              </td>
              <td onClick={e => e.stopPropagation()}>
                <div className="flex gap-sm">
                  <button className="btn btn-sm" onClick={() => setEditing(t)}>Edit</button>
                  <button className="btn btn-sm" onClick={() => handleDuplicate(t)}>Dup</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}>Del</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center" style={{ marginBottom: '1rem' }}>
              <h2>{selected.name}</h2>
              <button className="btn btn-sm" onClick={() => setSelected(null)}>Close</button>
            </div>

            <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
              <div className="macro-box">
                <h4>Timing</h4>
                <div className="macro-value">{selected.timing_window}</div>
                <div className="macro-label">{selected.meal_type}</div>
              </div>
              <div className="macro-box">
                <h4>Category</h4>
                <div className="macro-value">{selected.base_category}</div>
                <div className="macro-label">{selected.digestion_speed} digestion</div>
              </div>
              <div className="macro-box">
                <h4>Allergens</h4>
                <div className="macro-value" style={{ fontSize: '0.9rem' }}>
                  {(selected.allergens || []).length > 0 ? selected.allergens.join(', ') : 'None'}
                </div>
              </div>
            </div>

            <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
              <div className="macro-box">
                <h4>Carbs</h4>
                <div className="macro-value">{Number(selected.total_carbs_g).toFixed(1)}g</div>
              </div>
              <div className="macro-box">
                <h4>Protein</h4>
                <div className="macro-value">{Number(selected.total_protein_g).toFixed(1)}g</div>
              </div>
              <div className="macro-box">
                <h4>Fat</h4>
                <div className="macro-value">{Number(selected.total_fat_g).toFixed(1)}g</div>
              </div>
              <div className="macro-box">
                <h4>Calories</h4>
                <div className="macro-value">{selected.total_calories}</div>
              </div>
            </div>

            {(selected.excluded_diets || []).length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <strong>Excluded diets: </strong>
                {selected.excluded_diets.map(d => (
                  <span key={d} className="badge badge-warn" style={{ marginRight: '0.25rem' }}>{d}</span>
                ))}
              </div>
            )}

            <h3>Foods ({(selected.foods || []).length} items)</h3>
            {(() => {
              const groups = [...new Set((selected.foods || []).map(f => f.scale_group).filter(Boolean))];
              const GROUP_COLORS = ['#e8d5f5', '#d5e8f5', '#f5e8d5', '#d5f5e8', '#f5d5d5', '#f5f5d5'];
              return (
                <>
                  {groups.length > 0 && (
                    <div className="flex gap-sm flex-wrap" style={{ marginBottom: '0.5rem' }}>
                      {groups.map((g, gi) => (
                        <span key={g} style={{
                          display: 'inline-block', padding: '0.15rem 0.5rem',
                          borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                          backgroundColor: GROUP_COLORS[gi % GROUP_COLORS.length],
                        }}>
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                  <table>
                    <thead>
                      <tr>
                        <th>Food</th>
                        <th>Serving</th>
                        <th>Default</th>
                        <th>Min</th>
                        <th>Max</th>
                        <th>Carbs/srv</th>
                        <th>Total Carbs</th>
                        <th>Group</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selected.foods || []).map((f, i) => {
                        const gi = f.scale_group ? groups.indexOf(f.scale_group) : -1;
                        const bg = gi >= 0 ? GROUP_COLORS[gi % GROUP_COLORS.length] : undefined;
                        return (
                          <tr key={i} style={bg ? { backgroundColor: bg } : undefined}>
                            <td>{f.display_name}</td>
                            <td>{f.serving_size}</td>
                            <td>{f.default_servings}</td>
                            <td>{f.min_servings}</td>
                            <td>{f.max_servings}</td>
                            <td>{f.carbs_g}g</td>
                            <td><strong>{(f.carbs_g * f.default_servings).toFixed(1)}g</strong></td>
                            <td style={{ fontSize: '0.7rem' }}>{f.scale_group || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              );
            })()}

            {selected.notes && (
              <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#f8f8f5', borderRadius: '4px', fontSize: '0.8rem' }}>
                <strong>Notes:</strong> {selected.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <TemplateEditor
          template={editing}
          onSave={() => { setEditing(null); loadTemplates(); }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}
