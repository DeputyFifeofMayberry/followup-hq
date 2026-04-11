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
  selectedTaskId: null,
  itemModal: { open: false, mode: 'create', itemId: null },
  taskModal: { open: false, mode: 'create', taskId: null },
  followUpInspector: { open: false, itemId: null },
  recordDrawerRef: null,
  activeRecordSurface: 'none',
  activeRecordRef: null,
  activeEditorMode: null,
  recordSurfaceSource: null,
  createWorkDraft: null,
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

slice.openEditModal('FUP-1');
if (!state.itemModal.open || state.taskModal.open || state.recordDrawerRef !== null) throw new Error('openEditModal should focus canonical full-editor modal');
if (state.activeRecordSurface !== 'full_editor' || state.activeRecordRef?.id !== 'FUP-1') throw new Error('openEditModal should update unified record surface state');
slice.openRecordDrawer({ type: 'followup', id: 'FUP-1' });
if (!state.recordDrawerRef || state.itemModal.open || state.taskModal.open) throw new Error('openRecordDrawer should deconflict modal surfaces');
if ((state as any).activeRecordSurface !== 'context_drawer') throw new Error('openRecordDrawer should set context surface');

slice.openRecordEditor({ type: 'task', id: 'TSK-1' }, 'edit', 'test');
if (!(state as any).taskModal.open || (state as any).activeRecordSurface !== 'full_editor' || (state as any).activeRecordRef?.id !== 'TSK-1') throw new Error('openRecordEditor should support task full editor handoff');


slice.openFollowUpInspector('FUP-1', 'workspace');
if (!(state as any).followUpInspector.open || (state as any).followUpInspector.itemId !== 'FUP-1') throw new Error('openFollowUpInspector should open execution inspector for follow-up');
if ((state as any).activeRecordSurface !== 'execution_inspector' || (state as any).activeRecordRef?.id !== 'FUP-1') throw new Error('openFollowUpInspector should set execution inspector as active surface');

slice.openRecordEditor({ type: 'followup', id: 'FUP-1' }, 'edit', 'workspace');
if ((state as any).followUpInspector.open) throw new Error('openRecordEditor should close follow-up inspector when handing off to full edit');
