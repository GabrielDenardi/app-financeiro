import { supabase } from './supabase';

export async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  return data.user?.id ?? null;
}

export async function requireCurrentUserId(): Promise<string> {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error('Usuario nao autenticado.');
  }

  return userId;
}
