const METRICS_KEY = 'followup_hq_persistence_metrics_v1';

export interface PersistenceMetricsSnapshot {
  saveBatchAttempts: number;
  saveBatchCommits: number;
  saveBatchRejects: number;
  saveConflicts: number;
  outboxRetries: number;
  outboxRestoresOnStartup: number;
  verificationRuns: number;
  verificationMismatches: number;
  startupFallbackRecoveries: number;
  updatedAt: string;
}

const EMPTY_METRICS: PersistenceMetricsSnapshot = {
  saveBatchAttempts: 0,
  saveBatchCommits: 0,
  saveBatchRejects: 0,
  saveConflicts: 0,
  outboxRetries: 0,
  outboxRestoresOnStartup: 0,
  verificationRuns: 0,
  verificationMismatches: 0,
  startupFallbackRecoveries: 0,
  updatedAt: new Date(0).toISOString(),
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadPersistenceMetrics(): PersistenceMetricsSnapshot {
  if (!canUseStorage()) return { ...EMPTY_METRICS };
  try {
    const raw = window.localStorage.getItem(METRICS_KEY);
    if (!raw) return { ...EMPTY_METRICS };
    return { ...EMPTY_METRICS, ...(JSON.parse(raw) as Partial<PersistenceMetricsSnapshot>) };
  } catch {
    return { ...EMPTY_METRICS };
  }
}

export function updatePersistenceMetrics(mutator: (current: PersistenceMetricsSnapshot) => PersistenceMetricsSnapshot): PersistenceMetricsSnapshot {
  const next = { ...mutator(loadPersistenceMetrics()), updatedAt: new Date().toISOString() };
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(METRICS_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function incrementMetric(field: keyof Omit<PersistenceMetricsSnapshot, 'updatedAt'>, by = 1): PersistenceMetricsSnapshot {
  return updatePersistenceMetrics((current) => ({ ...current, [field]: current[field] + by }));
}
