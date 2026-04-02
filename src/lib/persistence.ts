import { supabase } from './supabase';
import { getDefaultOutlookSettings } from './outlookGraph';
import type {
  AppSnapshot,
  CompanyRecord,
  ContactRecord,
  FollowUpItem,
  PersistenceMode,
  ProjectRecord,
  TaskItem,
} from '../types';
import { getDefaultForwardedRules } from './intakeRules';

const LEGACY_BROWSER_SNAPSHOT_KEY = 'followup_hq_snapshot_v1';
const LOCAL_CACHE_KEY = 'followup_hq_entities_cache_v1';

export interface CoreEntities {
  items: FollowUpItem[];
  tasks: TaskItem[];
  projects: ProjectRecord[];
  contacts: ContactRecord[];
  companies: CompanyRecord[];
}

export interface AppAuxiliaryState {
  intakeSignals: AppSnapshot['intakeSignals'];
  intakeDocuments: AppSnapshot['intakeDocuments'];
  dismissedDuplicatePairs: AppSnapshot['dismissedDuplicatePairs'];
  droppedEmailImports: AppSnapshot['droppedEmailImports'];
  outlookConnection: AppSnapshot['outlookConnection'];
  outlookMessages: AppSnapshot['outlookMessages'];
  forwardedEmails: AppSnapshot['forwardedEmails'];
  forwardedRules: AppSnapshot['forwardedRules'];
  forwardedCandidates: AppSnapshot['forwardedCandidates'];
  forwardedLedger: AppSnapshot['forwardedLedger'];
  forwardedRoutingAudit: AppSnapshot['forwardedRoutingAudit'];
}

export interface PersistedPayload extends CoreEntities {
  auxiliary: AppAuxiliaryState;
}

interface LocalCachePayload {
  entities: PersistedPayload;
  updatedAt: string;
}

export interface LoadResult {
  payload: PersistedPayload;
  mode: PersistenceMode;
}

interface SaveResult {
  mode: PersistenceMode;
}

function buildFallbackSnapshot(): AppSnapshot {
  return {
    items: [],
    contacts: [],
    companies: [],
    projects: [],
    intakeSignals: [],
    intakeDocuments: [],
    dismissedDuplicatePairs: [],
    droppedEmailImports: [],
    outlookConnection: {
      settings: getDefaultOutlookSettings(),
      mailboxLinked: false,
      syncStatus: 'idle',
      syncCursorByFolder: { inbox: {}, sentitems: {} },
    },
    outlookMessages: [],
    tasks: [],
    forwardedEmails: [],
    forwardedRules: getDefaultForwardedRules(),
    forwardedCandidates: [],
    forwardedLedger: [],
    forwardedRoutingAudit: [],
  };
}

function fromSnapshot(snapshot: AppSnapshot): PersistedPayload {
  return {
    items: snapshot.items ?? [],
    tasks: snapshot.tasks ?? [],
    projects: snapshot.projects ?? [],
    contacts: snapshot.contacts ?? [],
    companies: snapshot.companies ?? [],
    auxiliary: {
      intakeSignals: snapshot.intakeSignals ?? [],
      intakeDocuments: snapshot.intakeDocuments ?? [],
      dismissedDuplicatePairs: snapshot.dismissedDuplicatePairs ?? [],
      droppedEmailImports: snapshot.droppedEmailImports ?? [],
      outlookConnection: snapshot.outlookConnection ?? buildFallbackSnapshot().outlookConnection,
      outlookMessages: snapshot.outlookMessages ?? [],
      forwardedEmails: snapshot.forwardedEmails ?? [],
      forwardedRules: snapshot.forwardedRules?.length ? snapshot.forwardedRules : getDefaultForwardedRules(),
      forwardedCandidates: snapshot.forwardedCandidates ?? [],
      forwardedLedger: snapshot.forwardedLedger ?? [],
      forwardedRoutingAudit: snapshot.forwardedRoutingAudit ?? [],
    },
  };
}

function buildEmptyPayload(): PersistedPayload {
  return fromSnapshot(buildFallbackSnapshot());
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readLocalCache(): PersistedPayload | null {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalCachePayload;
    return parsed.entities;
  } catch {
    return null;
  }
}

function writeLocalCache(payload: PersistedPayload): void {
  if (!canUseBrowserStorage()) return;
  try {
    const cache: LocalCachePayload = { entities: payload, updatedAt: new Date().toISOString() };
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
    window.localStorage.removeItem(LEGACY_BROWSER_SNAPSHOT_KEY);
  } catch {
    // ignore local cache errors
  }
}

function readLegacySnapshotFromBrowser(): AppSnapshot | null {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_BROWSER_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppSnapshot;
  } catch {
    return null;
  }
}

async function getSessionUserId(): Promise<string | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  return session?.user?.id ?? null;
}

async function readEntityRows<T>(table: string, userId: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('record').eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []).map((row) => row.record) as T[]);
}

async function readAuxiliaryState(userId: string): Promise<AppAuxiliaryState | null> {
  const { data, error } = await supabase.from('user_preferences').select('auxiliary').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (!data?.auxiliary) return null;
  return data.auxiliary as AppAuxiliaryState;
}

async function readLegacySnapshotFromSupabase(userId: string): Promise<AppSnapshot | null> {
  const { data, error } = await supabase.from('app_snapshots').select('snapshot').eq('user_id', userId).maybeSingle();
  if (error) return null;
  return (data?.snapshot as AppSnapshot | null) ?? null;
}

async function saveEntityTable(table: string, userId: string, records: Array<{ id: string }>) {
  const ids = records.map((record) => record.id);
  const payload = records.map((record) => ({ user_id: userId, record_id: record.id, record }));

  if (payload.length > 0) {
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'user_id,record_id' });
    if (error) throw error;
  }

  const { data: existingRows, error: existingError } = await supabase.from(table).select('record_id').eq('user_id', userId);
  if (existingError) throw existingError;

  const staleIds = (existingRows ?? []).map((row) => row.record_id as string).filter((id) => !ids.includes(id));
  if (staleIds.length > 0) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId).in('record_id', staleIds);
    if (error) throw error;
  }
}

async function saveAuxiliaryState(userId: string, auxiliary: AppAuxiliaryState, migrationComplete = true) {
  const { error } = await supabase.from('user_preferences').upsert({
    user_id: userId,
    auxiliary,
    migration_complete: migrationComplete,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) throw error;
}

function isCoreDataEmpty(payload: PersistedPayload): boolean {
  return payload.items.length === 0
    && payload.tasks.length === 0
    && payload.projects.length === 0
    && payload.contacts.length === 0
    && payload.companies.length === 0;
}

async function migrateLegacySnapshotIfNeeded(userId: string, currentPayload: PersistedPayload): Promise<PersistedPayload> {
  const { data: pref, error: prefError } = await supabase
    .from('user_preferences')
    .select('migration_complete, auxiliary')
    .eq('user_id', userId)
    .maybeSingle();

  if (prefError) throw prefError;

  if (pref?.migration_complete || !isCoreDataEmpty(currentPayload)) {
    if (pref?.auxiliary) {
      return { ...currentPayload, auxiliary: pref.auxiliary as AppAuxiliaryState };
    }
    return currentPayload;
  }

  const legacySnapshot = readLegacySnapshotFromBrowser() ?? await readLegacySnapshotFromSupabase(userId);
  if (!legacySnapshot) {
    await saveAuxiliaryState(userId, currentPayload.auxiliary, true);
    return currentPayload;
  }

  const migrated = fromSnapshot(legacySnapshot);
  await saveEntityTable('follow_up_items', userId, migrated.items);
  await saveEntityTable('tasks', userId, migrated.tasks);
  await saveEntityTable('projects', userId, migrated.projects);
  await saveEntityTable('contacts', userId, migrated.contacts);
  await saveEntityTable('companies', userId, migrated.companies);
  await saveAuxiliaryState(userId, migrated.auxiliary, true);
  writeLocalCache(migrated);
  return migrated;
}

export async function loadPersistedPayload(): Promise<LoadResult> {
  const cache = readLocalCache();

  let userId: string | null;
  try {
    userId = await getSessionUserId();
  } catch (error) {
    if (cache) return { payload: cache, mode: 'browser' };
    throw error;
  }

  if (!userId) {
    if (cache) return { payload: cache, mode: 'browser' };
    const legacy = readLegacySnapshotFromBrowser();
    const payload = legacy ? fromSnapshot(legacy) : buildEmptyPayload();
    writeLocalCache(payload);
    return { payload, mode: 'browser' };
  }

  const [items, tasks, projects, contacts, companies, auxiliary] = await Promise.all([
    readEntityRows<FollowUpItem>('follow_up_items', userId),
    readEntityRows<TaskItem>('tasks', userId),
    readEntityRows<ProjectRecord>('projects', userId),
    readEntityRows<ContactRecord>('contacts', userId),
    readEntityRows<CompanyRecord>('companies', userId),
    readAuxiliaryState(userId),
  ]);

  const payload: PersistedPayload = {
    items,
    tasks,
    projects,
    contacts,
    companies,
    auxiliary: auxiliary ?? buildEmptyPayload().auxiliary,
  };

  const hydrated = await migrateLegacySnapshotIfNeeded(userId, payload);
  writeLocalCache(hydrated);
  return { payload: hydrated, mode: 'supabase' };
}

export async function savePersistedPayload(payload: PersistedPayload): Promise<SaveResult> {
  writeLocalCache(payload);

  const userId = await getSessionUserId();
  if (!userId) {
    return { mode: 'browser' };
  }

  await saveEntityTable('follow_up_items', userId, payload.items);
  await saveEntityTable('tasks', userId, payload.tasks);
  await saveEntityTable('projects', userId, payload.projects);
  await saveEntityTable('contacts', userId, payload.contacts);
  await saveEntityTable('companies', userId, payload.companies);
  await saveAuxiliaryState(userId, payload.auxiliary, true);

  return { mode: 'supabase' };
}
