'use client';
import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export type AuthState =
  | { status: 'loading' }
  | { status: 'ready'; userId: string }
  | { status: 'error'; error: string };

export function useAnonAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const sb = getSupabaseBrowser();
    let cancelled = false;
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        if (!cancelled) setState({ status: 'ready', userId: session.user.id });
        return;
      }
      const { data, error } = await sb.auth.signInAnonymously();
      if (cancelled) return;
      if (error || !data.user) {
        setState({ status: 'error', error: error?.message ?? 'auth_failed' });
      } else {
        setState({ status: 'ready', userId: data.user.id });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return state;
}
