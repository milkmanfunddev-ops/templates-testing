import { useState } from 'react';
import { getSupabaseConfig, setSupabaseConfig, resetClient } from './lib/supabase';
import TemplateList from './components/TemplateList';
import FoodsCatalog from './components/FoodsCatalog';
import TemplateValidator from './components/TemplateValidator';
import TestRunner from './components/TestRunner';
import './App.css';

const TABS = ['Templates', 'Foods', 'Validator', 'Tests'];

function App() {
  const [activeTab, setActiveTab] = useState('Templates');
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState(getSupabaseConfig());

  const handleSaveConfig = () => {
    setSupabaseConfig(config.url, config.key);
    resetClient();
    setShowConfig(false);
    window.location.reload();
  };

  return (
    <div className="app">
      <header>
        <h1>Mealvana Template Testing</h1>
        <div className="header-actions">
          <button className="config-btn" onClick={() => setShowConfig(!showConfig)}>
            Settings
          </button>
        </div>
      </header>

      {showConfig && (
        <div className="config-panel">
          <label>
            Supabase URL:
            <input
              type="text"
              value={config.url}
              onChange={e => setConfig({ ...config, url: e.target.value })}
            />
          </label>
          <label>
            Supabase Anon Key:
            <input
              type="text"
              value={config.key}
              onChange={e => setConfig({ ...config, key: e.target.value })}
            />
          </label>
          <button onClick={handleSaveConfig}>Save & Reconnect</button>
        </div>
      )}

      <nav className="tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === 'Templates' && <TemplateList />}
        {activeTab === 'Foods' && <FoodsCatalog />}
        {activeTab === 'Validator' && <TemplateValidator />}
        {activeTab === 'Tests' && <TestRunner />}
      </main>
    </div>
  );
}

export default App;
