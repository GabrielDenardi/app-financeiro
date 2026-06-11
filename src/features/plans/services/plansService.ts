import { supabase } from '../../../lib/supabase';

export async function selectFreePlan(): Promise<void> {
  const { error } = await supabase.rpc('select_free_plan');

  if (error) {
    // Repassa a mensagem da RPC (ex.: bloqueio por assinatura ativa).
    throw new Error(error.message || 'Nao foi possivel ativar o plano Free. Tente novamente.');
  }
}
