import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CheckCircle2 } from 'lucide-react-native';

import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { startAbacatepaySubscription } from '../features/billing/abacatepayService';
import { useCurrentPlan, useStartTrialMutation } from '../features/plans/hooks';
import { SUBSCRIPTION_PLANS, TRIAL_DURATION_DAYS } from '../features/plans/plans';
import { selectFreePlan } from '../features/plans/services/plansService';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

const PLAN_ORDER = ['free', 'basic', 'intermediate', 'pro'] as const;

export function PlansScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthenticatedUser();
  const currentPlan = useCurrentPlan(user?.id);
  const startTrial = useStartTrialMutation(user?.id);
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null);

  const handleStartTrial = async () => {
    try {
      await startTrial.mutateAsync();
      Alert.alert(
        'Teste gratuito ativado',
        `Voce tem ${TRIAL_DURATION_DAYS} dias com os recursos do Plano Intermediario. Aproveite!`,
      );
    } catch (error) {
      Alert.alert(
        'Teste gratuito',
        error instanceof Error ? error.message : 'Nao foi possivel iniciar o periodo de teste.',
      );
    }
  };

  const handleSelectPlan = async (planId: (typeof PLAN_ORDER)[number]) => {
    if ((currentPlan.basePlanId ?? currentPlan.plan.id) === planId || selectingPlanId) {
      return;
    }

    if (planId === 'free') {
      Alert.alert(
        'Mudar para o plano Free',
        'Voce perdera o acesso aos recursos pagos. Deseja continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Confirmar',
            style: 'destructive',
            onPress: async () => {
              setSelectingPlanId(planId);
              try {
                await selectFreePlan();
                await currentPlan.refetch();
              } catch (error) {
                Alert.alert(
                  'Planos',
                  error instanceof Error ? error.message : 'Nao foi possivel mudar de plano.',
                );
              } finally {
                setSelectingPlanId(null);
              }
            },
          },
        ],
      );
      return;
    }

    setSelectingPlanId(planId);
    try {
      const checkoutUrl = await startAbacatepaySubscription(planId);
      const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, 'appfinanceiro://billing');
      if (result.type === 'success') {
        await currentPlan.refetch();
      }
    } catch (error) {
      Alert.alert(
        'Planos',
        error instanceof Error ? error.message : 'Nao foi possivel iniciar a assinatura.',
      );
    } finally {
      setSelectingPlanId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader title="Planos" subtitle="Compare limites e recursos." onBackPress={() => navigation.goBack()} />

      <Card style={styles.currentCard}>
        <Text style={styles.currentLabel}>Plano atual</Text>
        <Text style={styles.currentTitle}>{currentPlan.plan.name}</Text>
        {currentPlan.trial.isActive ? (
          <Text style={styles.currentTrial}>
            Teste gratuito — {currentPlan.trial.daysLeft}{' '}
            {currentPlan.trial.daysLeft === 1 ? 'dia restante' : 'dias restantes'}
          </Text>
        ) : null}
        <Text style={styles.currentText}>
          {currentPlan.entitlements.accountLimit} conta(s) financeira(s) e recursos conforme o plano.
        </Text>
      </Card>

      {currentPlan.trial.isEligible ? (
        <Card style={styles.trialCard}>
          <Text style={styles.trialTitle}>Experimente o Plano Intermediario</Text>
          <Text style={styles.trialText}>
            {TRIAL_DURATION_DAYS} dias gratis com relatorios completos, grupos e cadastro por voz.
            Sem cartao de credito.
          </Text>
          <Pressable
            style={[styles.planButton, startTrial.isPending && styles.planButtonMuted]}
            disabled={startTrial.isPending}
            onPress={handleStartTrial}
          >
            <Text style={[styles.planButtonText, startTrial.isPending && styles.planButtonMutedText]}>
              {startTrial.isPending
                ? 'Ativando...'
                : `Experimentar gratis por ${TRIAL_DURATION_DAYS} dias`}
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {PLAN_ORDER.map((planId) => {
        const plan = SUBSCRIPTION_PLANS[planId];
        const active = (currentPlan.basePlanId ?? currentPlan.plan.id) === plan.id;
        const selecting = selectingPlanId === plan.id;

        return (
          <Card key={plan.id} style={[styles.planCard, active && styles.activePlanCard]}>
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>
                  {plan.id === 'free' ? plan.priceLabel : `${plan.priceLabel}/mes`}
                </Text>
              </View>
              {active ? (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>Atual</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.benefits}>
              {plan.benefits.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <CheckCircle2 size={16} color={colors.success} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={[styles.planButton, (active || selecting) && styles.planButtonMuted]}
              disabled={active || Boolean(selectingPlanId)}
              onPress={() => handleSelectPlan(plan.id)}
            >
              <Text style={[styles.planButtonText, (active || selecting) && styles.planButtonMutedText]}>
                {active
                  ? 'Plano atual'
                  : selecting
                    ? plan.id === 'free'
                      ? 'Ativando...'
                      : 'Abrindo checkout...'
                    : plan.id === 'free'
                      ? 'Usar plano Free'
                      : 'Assinar'}
              </Text>
            </Pressable>
          </Card>
        );
      })}
    </PageShell>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    currentCard: {
      gap: spacing.xs,
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    currentLabel: {
      ...typography.caption,
      color: 'rgba(255,255,255,0.75)',
      fontWeight: '700',
    },
    currentTitle: {
      ...typography.h1,
      color: colors.white,
    },
    currentText: {
      ...typography.body,
      color: 'rgba(255,255,255,0.84)',
      lineHeight: 19,
    },
    currentTrial: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '800',
    },
    trialCard: {
      gap: spacing.sm,
      borderColor: colors.primaryLight,
    },
    trialTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    trialText: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    planCard: {
      gap: spacing.md,
    },
    activePlanCard: {
      borderColor: colors.primaryLight,
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    planName: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    planPrice: {
      ...typography.body,
      color: colors.primary,
      fontWeight: '800',
      marginTop: spacing.xs,
    },
    activeBadge: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    activeBadgeText: {
      ...typography.caption,
      color: colors.primary,
      fontWeight: '800',
    },
    benefits: {
      gap: spacing.sm,
    },
    benefitRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    benefitText: {
      ...typography.body,
      color: colors.textSecondary,
      flex: 1,
    },
    planButton: {
      minHeight: 48,
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planButtonMuted: {
      backgroundColor: colors.mutedSurface,
    },
    planButtonText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '800',
    },
    planButtonMutedText: {
      color: colors.textSecondary,
    },
  });
