import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log('SUPABASE URL:', url);
console.log('SUPABASE KEY PRESENT:', Boolean(key));

if (!url) {
  throw new Error('Missing VITE_SUPABASE_URL');
}

if (!key) {
  throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY');
}

export const supabase = createClient(url, key);