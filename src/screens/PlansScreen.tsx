import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { isRevenueCatTestStore } from '../config/env';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import {
  usePurchaseRevenueCatPlanMutation,
  useRestoreRevenueCatPurchasesMutation,
  useRevenueCatPlanPackages,
} from '../features/billing/hooks';
import {
  openGooglePlaySubscriptionManagement,
} from '../features/billing/revenuecatService';
import { useCurrentPlan, useStartTrialMutation } from '../features/plans/hooks';
import { SUBSCRIPTION_PLANS, TRIAL_DURATION_DAYS } from '../features/plans/plans';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

const PLAN_ORDER = ['free', 'basic', 'intermediate', 'pro'] as const;

export function PlansScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthenticatedUser();
  const currentPlan = useCurrentPlan(user?.id);
  const startTrial = useStartTrialMutation(user?.id);
  const storePackagesQuery = useRevenueCatPlanPackages(user?.id);
  const purchasePlan = usePurchaseRevenueCatPlanMutation(user?.id);
  const restorePurchases = useRestoreRevenueCatPurchasesMutation(user?.id);
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null);
  const storePackages = storePackagesQuery.data ?? {};
  const storeError =
    storePackagesQuery.error instanceof Error
      ? storePackagesQuery.error.message
      : null;
  const basePlanId = currentPlan.basePlanId ?? 'free';
  const basePlan = SUBSCRIPTION_PLANS[basePlanId];
  const trialOverridesBasePlan =
    currentPlan.trial.isActive && currentPlan.plan.id !== basePlan.id;

  const handleStartTrial = async () => {
    try {
      await startTrial.mutateAsync();
      Alert.alert(
        'Teste gratuito ativado',
        `Você tem ${TRIAL_DURATION_DAYS} dias com os recursos do Plano Intermediário. Aproveite!`,
      );
    } catch (error) {
      Alert.alert(
        'Teste gratuito',
        error instanceof Error ? error.message : 'Não foi possível iniciar o período de teste.',
      );
    }
  };

  const handleRestorePurchases = async () => {
    if (!user?.id || restorePurchases.isPending) {
      return;
    }

    try {
      const restored = await restorePurchases.mutateAsync();
      await currentPlan.refetch();
      Alert.alert(
        'Restaurar compras',
        restored
          ? 'Sua assinatura foi restaurada com sucesso.'
          : isRevenueCatTestStore
            ? 'Nenhuma assinatura de teste ativa foi encontrada.'
            : 'Nenhuma assinatura ativa foi encontrada nesta conta Google Play.',
      );
    } catch (error) {
      Alert.alert(
        'Restaurar compras',
        error instanceof Error ? error.message : 'Não foi possível restaurar suas compras.',
      );
    }
  };

  const handleSelectPlan = async (planId: (typeof PLAN_ORDER)[number]) => {
    if ((currentPlan.basePlanId ?? currentPlan.plan.id) === planId || selectingPlanId) {
      return;
    }

    if (planId === 'free') {
      if (isRevenueCatTestStore) {
        Alert.alert(
          'Assinatura de teste',
          'As assinaturas do RevenueCat Test Store expiram automaticamente. Reabra o app após a expiração para atualizar o Plano Free.',
        );
        return;
      }

      try {
        await openGooglePlaySubscriptionManagement();
      } catch (error) {
        Alert.alert(
          'Gerenciar assinatura',
          error instanceof Error
            ? error.message
            : 'Não foi possível abrir o gerenciamento da assinatura.',
        );
      }
      return;
    }

    if (!user?.id) {
      Alert.alert('Planos', 'Entre novamente na sua conta para assinar um plano.');
      return;
    }

    const selectedPackage = storePackages[planId];
    if (!selectedPackage) {
      Alert.alert(
        'Planos',
        storeError ?? 'Este plano ainda não está disponível na Google Play.',
      );
      return;
    }

    setSelectingPlanId(planId);
    try {
      const result = await purchasePlan.mutateAsync(selectedPackage);
      await currentPlan.refetch();
      Alert.alert(
        result.scheduled
          ? 'Mudança agendada'
          : isRevenueCatTestStore
            ? 'Compra de teste confirmada'
            : 'Assinatura confirmada',
        result.scheduled
          ? 'Seu novo plano entrará em vigor ao final do período atual.'
          : isRevenueCatTestStore
            ? 'Seu plano foi ativado no ambiente de teste da RevenueCat.'
            : 'Seu plano foi ativado pela Google Play.',
      );
    } catch (error) {
      Alert.alert(
        'Planos',
        error instanceof Error ? error.message : 'Não foi possível iniciar a assinatura.',
      );
    } finally {
      setSelectingPlanId(null);
    }
  };

  return (
    <PageShell>
      <PageHeader title="Planos" subtitle="Compare limites e recursos." onBackPress={() => navigation.goBack()} />

      <Card style={styles.currentCard}>
        <Text style={styles.currentLabel}>
          {trialOverridesBasePlan ? 'Benefícios atuais' : 'Plano atual'}
        </Text>
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
        {trialOverridesBasePlan ? (
          <Text style={styles.currentBasePlan}>
            Assinatura contratada: {basePlan.name}
          </Text>
        ) : null}
      </Card>

      {currentPlan.trial.isEligible ? (
        <Card style={styles.trialCard}>
          <Text style={styles.trialTitle}>Experimente o Plano Intermediário</Text>
          <Text style={styles.trialText}>
            {TRIAL_DURATION_DAYS} dias grátis com relatórios completos, grupos e cadastro por voz.
            Sem cartão de crédito.
          </Text>
          <Pressable
            style={[styles.planButton, startTrial.isPending && styles.planButtonMuted]}
            disabled={startTrial.isPending}
            onPress={handleStartTrial}
          >
            <Text style={[styles.planButtonText, startTrial.isPending && styles.planButtonMutedText]}>
              {startTrial.isPending
                ? 'Ativando...'
                : `Experimentar grátis por ${TRIAL_DURATION_DAYS} dias`}
            </Text>
          </Pressable>
        </Card>
      ) : null}

      {PLAN_ORDER.map((planId) => {
        const plan = SUBSCRIPTION_PLANS[planId];
        const active = basePlanId === plan.id;
        const selecting = selectingPlanId === plan.id;
        const storePackage = plan.id === 'free' ? null : storePackages[plan.id];
        const priceLabel = storePackage?.localizedPrice ?? plan.priceLabel;

        return (
          <Card key={plan.id} style={[styles.planCard, active && styles.activePlanCard]}>
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>
                  {plan.id === 'free' ? priceLabel : `${priceLabel}/mês`}
                </Text>
              </View>
              {active ? (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>
                    {trialOverridesBasePlan ? 'Assinatura' : 'Atual'}
                  </Text>
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
                  ? trialOverridesBasePlan
                    ? 'Assinatura atual'
                    : 'Plano atual'
                  : selecting
                    ? plan.id === 'free'
                      ? 'Abrindo...'
                      : 'Processando compra...'
                    : plan.id === 'free'
                      ? 'Gerenciar assinatura'
                      : 'Assinar'}
              </Text>
            </Pressable>
          </Card>
        );
      })}

      {storeError ? <Text style={styles.storeMessage}>{storeError}</Text> : null}

      <Pressable
        style={styles.restoreButton}
        disabled={restorePurchases.isPending || Boolean(selectingPlanId)}
        onPress={handleRestorePurchases}
      >
        <Text style={styles.restoreButtonText}>
          {restorePurchases.isPending ? 'Restaurando...' : 'Restaurar compras'}
        </Text>
      </Pressable>

      <Text style={styles.storeFootnote}>
        {isRevenueCatTestStore
          ? 'Ambiente de teste da RevenueCat: nenhuma cobrança real será realizada.'
          : 'Pagamento, renovação e cancelamento são gerenciados pela Google Play.'}
      </Text>
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
      color: colors.whiteAlpha80,
      fontWeight: '700',
    },
    currentTitle: {
      ...typography.h1,
      color: colors.white,
    },
    currentText: {
      ...typography.body,
      color: colors.whiteAlpha80,
      lineHeight: 19,
    },
    currentTrial: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '800',
    },
    currentBasePlan: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '700',
      marginTop: spacing.xs,
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
    storeMessage: {
      ...typography.caption,
      color: colors.danger,
      textAlign: 'center',
    },
    restoreButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    restoreButtonText: {
      ...typography.body,
      color: colors.primary,
      fontWeight: '800',
    },
    storeFootnote: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
  });
