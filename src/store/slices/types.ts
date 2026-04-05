import type { StateCreator } from 'zustand';
import type { AppStore } from '../types';
import type { QueueRequestMeta } from '../persistenceQueue';

export type SliceSet = Parameters<StateCreator<AppStore>>[0];
export type SliceGet = Parameters<StateCreator<AppStore>>[1];

export interface SliceContext {
  queuePersist: (meta?: QueueRequestMeta) => void;
}
