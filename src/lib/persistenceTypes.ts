export type SaveBatchEntity = 'items' | 'tasks' | 'projects' | 'contacts' | 'companies';

export type SaveBatchOperationType = 'upsert' | 'delete';

export interface SaveBatchOperation {
  entity: SaveBatchEntity;
  recordId: string;
  operation: SaveBatchOperationType;
  recordSnapshot?: unknown;
  deletedAt?: string;
  expectedRecordVersion?: number | null;
  expectedDeletedAt?: string | null;
  expectedLastBatchId?: string | null;
}

export interface SaveBatchEntityCounts {
  items: { upserts: number; deletes: number };
  tasks: { upserts: number; deletes: number };
  projects: { upserts: number; deletes: number };
  contacts: { upserts: number; deletes: number };
  companies: { upserts: number; deletes: number };
}

export interface SaveBatchEnvelope {
  batchId: string;
  schemaVersion: number;
  deviceId: string;
  sessionId: string;
  clientGeneratedAt: string;
  operations: SaveBatchOperation[];
  operationCount: number;
  operationCountsByEntity: SaveBatchEntityCounts;
  auxiliary?: Record<string, unknown> | null;
  clientPayloadHash: string;
}

export type SaveBatchStatus = 'committed' | 'rejected' | 'received' | 'conflict';

export interface SaveBatchReceipt {
  batchId: string;
  userId: string;
  status: SaveBatchStatus;
  committedAt?: string;
  schemaVersion: number;
  operationCount: number;
  appliedOperationCount?: number;
  conflictedOperationCount?: number;
  operationCountsByEntity: SaveBatchEntityCounts;
  touchedTables: string[];
  clientPayloadHash?: string;
  serverPayloadHash: string;
  hashMatch: boolean;
  conflictIds?: string[];
  conflictCountByEntity?: Record<string, number>;
  conflictCountByType?: Record<string, number>;
  outboxSafeToClear?: boolean;
}

export interface SaveBatchFailureSummary {
  batchId?: string;
  status?: SaveBatchStatus;
  errorCode?: string;
  errorMessage: string;
  details?: Record<string, unknown>;
}
