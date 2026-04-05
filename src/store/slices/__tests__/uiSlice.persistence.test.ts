import { createUiSlice } from '../uiSlice';
import { defaultFollowUpFilters } from '../../../lib/followUpSelectors';
import type { AppStore } from '../../types';

let state = {
  followUpFilters: defaultFollowUpFilters,
  savedFollowUpViews: [{ id: 'view-1', name: 'Saved', search: '', activeView: 'All', filters: defaultFollowUpFilters, createdAt: '2026-04-05' }],
  activeView: 'All',
  search: '',
  followUpColumns: ['title'],
  selectedFollowUpIds: [],
  selectedId: null,
} as unknown as AppStore;

let queueCount = 0;
const set = ((updater: any) => {
  if (typeof updater === 'function') {
    state = { ...state, ...updater(state) };
  } else {
    state = { ...state, ...updater };
  }
}) as any;

const slice = createUiSlice(set, () => { queueCount += 1; });
slice.setFollowUpFilters({ project: 'Alpha' });
slice.setFollowUpColumns(['title', 'status']);
slice.saveFollowUpCustomView('My view', 'abc');
slice.applySavedFollowUpCustomView('view-1');

if (queueCount !== 4) throw new Error('persisted follow-up actions should queue persistence');
