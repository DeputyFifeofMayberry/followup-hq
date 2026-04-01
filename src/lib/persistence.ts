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

const LOCAL_SNAPSHOT_KEY = 'followup-hq:snapshot:v1';

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

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readBrowserSnapshot(): AppSnapshot | null {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppSnapshot;
  } catch {
    return null;
  }
}

function writeBrowserSnapshot(snapshot: AppSnapshot): void {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.setItem(LOCAL_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore quota / serialization issues and keep the main persistence path alive.
  }
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function loadSnapshot(): Promise<{ snapshot: AppSnapshot; mode: PersistenceMode; lastSyncedAt?: string }> {
  const browserSnapshot = readBrowserSnapshot();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    if (browserSnapshot) return { snapshot: browserSnapshot, mode: 'browser' };
    throw sessionError;
  }

  const user = session?.user;
  if (!user) {
    if (browserSnapshot) return { snapshot: browserSnapshot, mode: 'browser' };
    throw new Error('No authenticated user.');
  }

  const { data, error } = await supabase
    .from('app_snapshots')
    .select('snapshot, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    if (browserSnapshot) return { snapshot: browserSnapshot, mode: 'browser' };
    throw error;
  }

  if (!data?.snapshot) {
    const snapshot = browserSnapshot ?? buildFallbackSnapshot();
    const insertedAt = new Date().toISOString();

    const { error: insertError } = await supabase.from('app_snapshots').insert({
      user_id: user.id,
      snapshot,
      updated_at: insertedAt,
    });

    if (insertError) {
      if (browserSnapshot) return { snapshot: browserSnapshot, mode: 'browser' };
      throw insertError;
    }

    writeBrowserSnapshot(snapshot);
    return { snapshot, mode: 'supabase', lastSyncedAt: insertedAt };
  }

  const snapshot = data.snapshot as AppSnapshot;
  writeBrowserSnapshot(snapshot);
  return {
    snapshot,
    mode: 'supabase',
    lastSyncedAt: data.updated_at ?? undefined,
  };
}

export async function saveSnapshot(snapshot: AppSnapshot): Promise<{ mode: PersistenceMode; lastSyncedAt: string }> {
  writeBrowserSnapshot(snapshot);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    return { mode: 'browser', lastSyncedAt: new Date().toISOString() };
  }

  const user = session?.user;
  if (!user) {
    return { mode: 'browser', lastSyncedAt: new Date().toISOString() };
  }

  const savedAt = new Date().toISOString();
  const { error } = await supabase.from('app_snapshots').upsert({
    user_id: user.id,
    snapshot,
    updated_at: savedAt,
  });

  if (error) {
    throw error;
  }

  return { mode: 'supabase', lastSyncedAt: savedAt };
}
