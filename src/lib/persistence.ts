import { supabase } from './supabase';
import { getDefaultOutlookSettings } from './outlookGraph';
import {
  starterCompanies,
  starterContacts,
  starterIntakeDocuments,
  starterItems,
  starterProjects,
  starterSignals,
} from './sample-data';
import type { AppSnapshot, PersistenceMode } from '../types';

function buildFallbackSnapshot(): AppSnapshot {
  return {
    items: starterItems,
    contacts: starterContacts,
    companies: starterCompanies,
    projects: starterProjects,
    intakeSignals: starterSignals,
    intakeDocuments: starterIntakeDocuments,
    dismissedDuplicatePairs: [],
    droppedEmailImports: [],
    outlookConnection: {
      settings: getDefaultOutlookSettings(),
      mailboxLinked: false,
      syncStatus: 'idle',
      syncCursorByFolder: { inbox: {}, sentitems: {} },
    },
    outlookMessages: [],
  };
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function loadSnapshot(): Promise<{ snapshot: AppSnapshot; mode: PersistenceMode }> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const user = session?.user;
  if (!user) {
    throw new Error('No authenticated user.');
  }

  const { data, error } = await supabase
    .from('app_snapshots')
    .select('snapshot')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.snapshot) {
    const snapshot = buildFallbackSnapshot();

    const { error: insertError } = await supabase.from('app_snapshots').insert({
      user_id: user.id,
      snapshot,
    });

    if (insertError) {
      throw insertError;
    }

    return { snapshot, mode: 'supabase' };
  }

  return {
    snapshot: data.snapshot as AppSnapshot,
    mode: 'supabase',
  };
}

export async function saveSnapshot(snapshot: AppSnapshot): Promise<PersistenceMode> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  const user = session?.user;
  if (!user) {
    throw new Error('No authenticated user.');
  }

  const { error } = await supabase.from('app_snapshots').upsert({
    user_id: user.id,
    snapshot,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  return 'supabase';
}