import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2 } from 'lucide-react-native';

import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useCurrentPlan } from '../features/plans/hooks';
import { SUBSCRIPTION_PLANS } from '../features/plans/plans';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../theme';

const PLAN_ORDER = ['basic', 'intermediate', 'pro'] as const;

export function PlansScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const user = useAuthenticatedUser();
  const currentPlan = useCurrentPlan(user?.id);

  const showBillingNotice = () => {
    Alert.alert('Planos', 'A cobranca ainda nao esta ativa. Esta tela mostra as opcoes disponiveis.');
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

            <Pressable style={[styles.planButton, active && styles.planButtonMuted]} onPress={showBillingNotice}>
              <Text style={[styles.planButtonText, active && styles.planButtonMutedText]}>
                {active ? 'Plano atual' : 'Ver opcao'}
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
