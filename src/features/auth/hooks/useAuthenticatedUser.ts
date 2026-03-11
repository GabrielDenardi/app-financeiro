import { useEffect, useState } from 'react';

import { supabase } from '../../../lib/supabase';
import type { AuthenticatedUserSummary } from '../../../types/auth';

function mapAuthUser(user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] | null) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    fullName:
      typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name.trim() : '',
  } satisfies AuthenticatedUserSummary;
}

export function useAuthenticatedUser(initialUser: AuthenticatedUserSummary | null = null) {
  const [currentUser, setCurrentUser] = useState<AuthenticatedUserSummary | null>(initialUser);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (mounted) {
          setCurrentUser(mapAuthUser(data.user));
        }
      })
      .catch(() => {
        if (mounted) {
          setCurrentUser(null);
        }
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }

      setCurrentUser(mapAuthUser(session?.user ?? null));
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return currentUser;
}
