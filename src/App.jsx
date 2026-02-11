import { useState } from 'react';
import TemplateList from './components/TemplateList';
import FoodsCatalog from './components/FoodsCatalog';
import TemplateValidator from './components/TemplateValidator';
import TestRunner from './components/TestRunner';
import './App.css';

const TABS = ['Templates', 'Foods', 'Validator', 'Tests'];

function App() {
  const [activeTab, setActiveTab] = useState('Templates');

  return (
    <div className="app">
      <header>
        <h1>Mealvana Template Testing</h1>
      </header>

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
