/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env)
  ? (import.meta as { env?: Record<string, string | undefined> }).env!
  : {};

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigError = !url
  ? 'Missing VITE_SUPABASE_URL'
  : !key
    ? 'Missing VITE_SUPABASE_PUBLISHABLE_KEY'
    : null;

const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackKey = 'placeholder-publishable-key';
const activeUrl = url ?? fallbackUrl;

export function getSupabaseHost(): string {
  try {
    return new URL(activeUrl).host;
  } catch {
    return 'unknown-supabase-host';
  }
}

export const supabase = createClient(activeUrl, key ?? fallbackKey, {
  auth: {
    persistSession: Boolean(url && key),
    autoRefreshToken: Boolean(url && key),
    detectSessionInUrl: Boolean(url && key),
  },
});
