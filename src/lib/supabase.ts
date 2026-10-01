import { createClient } from '@supabase/supabase-js';

// Live Supabase credentials — intentionally HARDCODED (product decision, v2.6.4+).
// The anon key is a PUBLIC client key protected by Row Level Security, so
// embedding it keeps every environment (Render, Vercel, local dev) connected
// to the live project with zero env configuration.
const HARDCODED_SUPABASE_URL = 'https://vbufsuzzmehsidshopku.supabase.co';
const HARDCODED_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZidWZzdXp6bWVoc2lkc2hvcGt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyOTE0MjMsImV4cCI6MjEwNTg2NzQyM30.kymgulEpO3R7FRhrfFO-lpmYrAcOqBF82sSW4unZHBE';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || HARDCODED_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || HARDCODED_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('demo-tsos-project'));
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
