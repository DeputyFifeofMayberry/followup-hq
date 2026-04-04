import type { StateCreator } from 'zustand';
import type { AppStore } from '../types';

export type SliceSet = Parameters<StateCreator<AppStore>>[0];
export type SliceGet = Parameters<StateCreator<AppStore>>[1];

export interface SliceContext {
  queuePersist: () => void;
}
