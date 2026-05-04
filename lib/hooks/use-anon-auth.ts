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
      // 1. Read the cached session from localStorage.
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        // 2. Verify it against the server. getSession() trusts the JWT
        // locally; getUser() is a real round-trip and will fail if the
        // user was deleted (e.g. local Supabase reset, server-side wipe,
        // expired JWT). On failure, drop the stale session and re-auth.
        const { data: { user }, error } = await sb.auth.getUser();
        if (!cancelled && user && !error) {
          setState({ status: 'ready', userId: user.id });
          return;
        }
        await sb.auth.signOut();
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
