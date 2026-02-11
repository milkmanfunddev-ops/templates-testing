import { useState, useEffect } from 'react';
import { getClient } from '../lib/supabase';
import { getDefaultProfile } from '../lib/dietFilter';
import MealChainValidator from './MealChainValidator';

export default function TemplateValidator() {
  const [templates, setTemplates] = useState([]);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(getDefaultProfile());

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [tRes, fRes] = await Promise.all([
      getClient().from('templates').select('*').eq('is_active', true).order('sort_order'),
      getClient().from('template_foods').select('*').eq('is_active', true).order('name'),
    ]);
    setTemplates(tRes.data || []);
    setFoods(fRes.data || []);
    setLoading(false);
  }

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <MealChainValidator
      templates={templates}
      foods={foods}
      profile={profile}
      onProfileChange={setProfile}
    />
  );
}
