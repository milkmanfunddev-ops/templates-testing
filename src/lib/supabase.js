import { createClient } from '@supabase/supabase-js';

// Default to local Supabase (can be overridden via localStorage)
const DEFAULT_URL = 'http://localhost:54321';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export function getSupabaseConfig() {
  return {
    url: localStorage.getItem('supabase_url') || DEFAULT_URL,
    key: localStorage.getItem('supabase_key') || DEFAULT_KEY,
  };
}

export function setSupabaseConfig(url, key) {
  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);
}

let _client = null;

export function getClient() {
  const { url, key } = getSupabaseConfig();
  if (!_client || _client._url !== url) {
    _client = createClient(url, key);
    _client._url = url;
  }
  return _client;
}

export function resetClient() {
  _client = null;
}
