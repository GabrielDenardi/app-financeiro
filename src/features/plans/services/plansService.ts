import { supabase } from '../../../lib/supabase';
import { formatMonthDate, toNumber } from '../../finance/utils';

export type PaywallStats = {
  totalTransactions: number;
  monthTransactions: number;
  monthExpense: number;
};

/**
 * Inicia o trial gratuito de 7 dias do plano Intermediario.
 * Retorna a data de termino do trial.
 */
export async function startIntermediateTrial(): Promise<string> {
  const { data, error } = await supabase.rpc('start_intermediate_trial');

  if (error) {
    // Repassa a mensagem da RPC (ex.: trial ja utilizado, plano ja superior).
    throw new Error(error.message || 'Nao foi possivel iniciar o periodo de teste.');
  }

  return data as string;
}

/**
 * Estatisticas reais do usuario exibidas no paywall contextual
 * ("Voce ja registrou X transacoes...").
 */
export async function getPaywallStats(userId: string): Promise<PaywallStats> {
  const monthStart = formatMonthDate();

  const [totalResult, monthResult] = await Promise.all([
    supabase
      .from('personal_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('personal_transactions')
      .select('amount, type')
      .eq('user_id', userId)
      .gte('occurred_at', monthStart),
  ]);

  if (totalResult.error) {
    throw new Error(totalResult.error.message);
  }

  if (monthResult.error) {
    throw new Error(monthResult.error.message);
  }

  const monthRows = (monthResult.data ?? []) as Array<{ amount: number | string | null; type: string }>;
  const monthExpense = monthRows
    .filter((row) => row.type === 'expense')
    .reduce((sum, row) => sum + toNumber(row.amount), 0);

  return {
    totalTransactions: totalResult.count ?? 0,
    monthTransactions: monthRows.length,
    monthExpense,
  };
}
