import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { CheckCircle2 } from 'lucide-react-native';

import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { startAbacatepaySubscription } from '../features/billing/abacatepayService';
import { useCurrentPlan } from '../features/plans/hooks';
import { SUBSCRIPTION_PLANS } from '../features/plans/plans';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

const PLAN_ORDER = ['basic', 'intermediate', 'pro'] as const;

export function PlansScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthenticatedUser();
  const currentPlan = useCurrentPlan(user?.id);
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null);

  const handleSelectPlan = async (planId: (typeof PLAN_ORDER)[number]) => {
    if (currentPlan.plan.id === planId || selectingPlanId) {
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
        <Text style={styles.currentText}>
          {currentPlan.entitlements.accountLimit} conta(s) financeira(s) e recursos conforme o plano.
        </Text>
      </Card>

      {PLAN_ORDER.map((planId) => {
        const plan = SUBSCRIPTION_PLANS[planId];
        const active = currentPlan.plan.id === plan.id;
        const selecting = selectingPlanId === plan.id;

        return (
          <Card key={plan.id} style={[styles.planCard, active && styles.activePlanCard]}>
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>{plan.priceLabel}/mes</Text>
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
                {active ? 'Plano atual' : selecting ? 'Abrindo checkout...' : 'Assinar'}
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
