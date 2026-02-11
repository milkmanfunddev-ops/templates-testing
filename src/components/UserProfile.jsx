import { useState } from 'react';
import { DIETARY_PREFERENCES, ALLERGENS, PRESET_PROFILES, getDefaultProfile } from '../lib/dietFilter';

export default function UserProfile({ profile: externalProfile, onProfileChange, foods }) {
  const profile = externalProfile || getDefaultProfile();

  const handlePreset = (preset) => {
    onProfileChange({ diet: preset.diet, allergens: [...preset.allergens], excludedFoods: [...preset.excludedFoods] });
  };

  const handleDietChange = (diet) => {
    onProfileChange({ ...profile, diet });
  };

  const handleAllergenToggle = (allergen) => {
    const has = profile.allergens.includes(allergen);
    const allergens = has ? profile.allergens.filter(a => a !== allergen) : [...profile.allergens, allergen];
    onProfileChange({ ...profile, allergens });
  };

  const handleExcludeFood = (foodName) => {
    if (!profile.excludedFoods.includes(foodName)) {
      onProfileChange({ ...profile, excludedFoods: [...profile.excludedFoods, foodName] });
    }
  };

  const handleRemoveExcluded = (foodName) => {
    onProfileChange({ ...profile, excludedFoods: profile.excludedFoods.filter(f => f !== foodName) });
  };

  return (
    <div className="user-profile">
      <h4>Diet Profile</h4>

      {/* Preset buttons */}
      <div className="preset-row">
        {PRESET_PROFILES.map(p => (
          <button
            key={p.label}
            className={`filter-chip ${profile.diet === p.diet && JSON.stringify(profile.allergens) === JSON.stringify(p.allergens) ? 'active' : ''}`}
            onClick={() => handlePreset(p)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Diet dropdown */}
      <div className="field-row" style={{ marginTop: '0.5rem' }}>
        <label>Diet:</label>
        <select value={profile.diet} onChange={e => handleDietChange(e.target.value)}>
          {DIETARY_PREFERENCES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Allergen checkboxes */}
      <div style={{ marginTop: '0.5rem' }}>
        <label>Allergens:</label>
        <div className="allergen-grid">
          {ALLERGENS.map(a => (
            <label key={a} className="allergen-check">
              <input
                type="checkbox"
                checked={profile.allergens.includes(a)}
                onChange={() => handleAllergenToggle(a)}
              />
              {a}
            </label>
          ))}
        </div>
      </div>

      {/* Food exclusions */}
      {foods && foods.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <label>Exclude foods:</label>
          <select onChange={e => { if (e.target.value) { handleExcludeFood(e.target.value); e.target.value = ''; } }}>
            <option value="">Select a food...</option>
            {foods
              .filter(f => !profile.excludedFoods.includes(f.display_name))
              .map(f => <option key={f.id || f.name} value={f.display_name}>{f.display_name}</option>)
            }
          </select>
          <div className="excluded-pills">
            {profile.excludedFoods.map(f => (
              <span key={f} className="pill" onClick={() => handleRemoveExcluded(f)}>
                {f} ×
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
