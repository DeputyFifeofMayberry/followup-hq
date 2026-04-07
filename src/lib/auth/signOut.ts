import type { Session } from '@supabase/supabase-js';

import { supabase } from '../supabase';
import { clearScopedPersistenceForUser } from '../persistence';
import { resetSessionScopedId, setPersistenceScopeUserId } from '../persistenceIdentity';
import { useAppStore } from '../../store/useAppStore';

export type SignOutLocalPolicy = 'clear-scoped-persistence' | 'keep-protected-recovery';

export interface PerformSignOutOptions {
  session: Session;
  localPolicy: SignOutLocalPolicy;
}

export async function performSignOut({ session, localPolicy }: PerformSignOutOptions): Promise<void> {
  const userId = session.user.id;
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message || 'Sign out failed.');
  }

  if (localPolicy === 'clear-scoped-persistence') {
    await clearScopedPersistenceForUser(userId);
  }

  setPersistenceScopeUserId(null);
  resetSessionScopedId();
  useAppStore.getState().resetForLogout();
}
