/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigError = !url
  ? 'Missing VITE_SUPABASE_URL'
  : !key
    ? 'Missing VITE_SUPABASE_PUBLISHABLE_KEY'
    : null;

const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackKey = 'placeholder-publishable-key';

export const supabase = createClient(url ?? fallbackUrl, key ?? fallbackKey, {
  auth: {
    persistSession: Boolean(url && key),
    autoRefreshToken: Boolean(url && key),
    detectSessionInUrl: Boolean(url && key),
  },
});
