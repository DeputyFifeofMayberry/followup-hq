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

const LOCAL_SNAPSHOT_KEY = 'followup-hq-app-snapshot';

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

export function readLocalSnapshot(): AppSnapshot | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(LOCAL_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppSnapshot;
  } catch {
    return null;
  }
}

export function writeLocalSnapshot(snapshot: AppSnapshot): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(LOCAL_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore local cache failures. Supabase remains the source of truth.
  }
}

export async function loadSnapshot(): Promise<{ snapshot: AppSnapshot; mode: PersistenceMode }> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    const local = readLocalSnapshot();
    if (local) return { snapshot: local, mode: 'browser' };
    throw sessionError;
  }

  const user = session?.user;
  if (!user) {
    const local = readLocalSnapshot();
    if (local) return { snapshot: local, mode: 'browser' };
    throw new Error('No authenticated user.');
  }

  const { data, error } = await supabase
    .from('app_snapshots')
    .select('snapshot')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    const local = readLocalSnapshot();
    if (local) return { snapshot: local, mode: 'browser' };
    throw error;
  }

  if (!data?.snapshot) {
    const snapshot = readLocalSnapshot() ?? buildFallbackSnapshot();

    const { error: insertError } = await supabase.from('app_snapshots').insert({
      user_id: user.id,
      snapshot,
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      writeLocalSnapshot(snapshot);
      return { snapshot, mode: 'browser' };
    }

    writeLocalSnapshot(snapshot);
    return { snapshot, mode: 'supabase' };
  }

  const snapshot = data.snapshot as AppSnapshot;
  writeLocalSnapshot(snapshot);

  return {
    snapshot,
    mode: 'supabase',
  };
}

export async function saveSnapshot(snapshot: AppSnapshot): Promise<PersistenceMode> {
  writeLocalSnapshot(snapshot);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return 'browser';
  }

  const user = session?.user;
  if (!user) {
    return 'browser';
  }

  const { error } = await supabase.from('app_snapshots').upsert({
    user_id: user.id,
    snapshot,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return 'browser';
  }

  return 'supabase';
}
