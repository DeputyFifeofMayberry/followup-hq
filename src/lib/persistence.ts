import { supabase } from './supabase';
import { getDefaultOutlookSettings } from './outlookGraph';
import { getDefaultOutlookTriageRules } from './outlookRules';
import {
  starterCompanies,
  starterContacts,
  starterIntakeDocuments,
  starterItems,
  starterProjects,
  starterSignals,
  starterTasks,
} from './sample-data';
import type { AppSnapshot, PersistenceMode } from '../types';

const BROWSER_SNAPSHOT_KEY = 'followup_hq_snapshot_v1';

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
    tasks: starterTasks,
    outlookTriageRules: getDefaultOutlookTriageRules(),
    outlookIngestionLedger: [],
    outlookTriageCandidates: [],
    outlookAutomationAudit: [],
  };
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadBrowserSnapshot(): AppSnapshot | null {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(BROWSER_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppSnapshot;
  } catch {
    return null;
  }
}

export function saveBrowserSnapshot(snapshot: AppSnapshot): void {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.setItem(BROWSER_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore local cache errors
  }
}

export async function loadSnapshot(): Promise<{ snapshot: AppSnapshot; mode: PersistenceMode }> {
  const browserSnapshot = loadBrowserSnapshot();

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
    .select('snapshot')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    if (browserSnapshot) return { snapshot: browserSnapshot, mode: 'browser' };
    throw error;
  }

  if (!data?.snapshot) {
    const snapshot = browserSnapshot ?? buildFallbackSnapshot();

    const { error: insertError } = await supabase.from('app_snapshots').insert({
      user_id: user.id,
      snapshot,
    });

    if (insertError) {
      saveBrowserSnapshot(snapshot);
      return { snapshot, mode: 'browser' };
    }

    saveBrowserSnapshot(snapshot);
    return { snapshot, mode: 'supabase' };
  }

  const snapshot = data.snapshot as AppSnapshot;
  saveBrowserSnapshot(snapshot);
  return {
    snapshot,
    mode: 'supabase',
  };
}

export async function saveSnapshot(snapshot: AppSnapshot): Promise<PersistenceMode> {
  saveBrowserSnapshot(snapshot);

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
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
    throw error;
  }

  return 'supabase';
}
