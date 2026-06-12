import { useMemo } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { CheckCircle2, Lock } from 'lucide-react-native';

import { useAuthenticatedUser } from '../../auth/hooks/useAuthenticatedUser';
import type { AppStackParamList } from '../../../navigation/types';
import { formatCurrencyBRL } from '../../../utils/format';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../../../theme';
import { SUBSCRIPTION_PLANS, TRIAL_DURATION_DAYS } from '../plans';
import { useCurrentPlan, usePaywallStats, useStartTrialMutation } from '../hooks';

type UpgradePaywallSheetProps = {
  visible: boolean;
  onClose: () => void;
  featureTitle: string;
  description?: string;
};

/**
 * Paywall contextual: aparece quando o usuario tenta usar um recurso que o
 * plano atual nao cobre. Usa os dados reais do usuario como argumento e
 * oferece o trial gratuito do Intermediario quando elegivel.
 */
export function UpgradePaywallSheet({
  visible,
  onClose,
  featureTitle,
  description,
}: UpgradePaywallSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const user = useAuthenticatedUser();
  const currentPlan = useCurrentPlan(user?.id);
  const statsQuery = usePaywallStats(user?.id, visible);
  const startTrial = useStartTrialMutation(user?.id);

  const stats = statsQuery.data;
  const intermediate = SUBSCRIPTION_PLANS.intermediate;

  const handleStartTrial = async () => {
    try {
      await startTrial.mutateAsync();
      onClose();
      Alert.alert(
        'Teste gratuito ativado',
        `Voce tem ${TRIAL_DURATION_DAYS} dias com os recursos do ${intermediate.name}. Aproveite!`,
      );
    } catch (error) {
      Alert.alert(
        'Teste gratuito',
        error instanceof Error ? error.message : 'Nao foi possivel iniciar o periodo de teste.',
      );
    }
  };

  const handleSeePlans = () => {
    onClose();
    navigation.navigate('Plans');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconWrapper}>
            <Lock size={26} color={colors.primary} />
          </View>

          <Text style={styles.title}>{featureTitle}</Text>
          <Text style={styles.subtitle}>
            {description ?? `${featureTitle} nao esta incluido no seu plano atual.`}
          </Text>

          {stats && stats.totalTransactions > 0 ? (
            <View style={styles.statsCard}>
              <Text style={styles.statsHighlight}>
                Voce ja registrou {stats.totalTransactions}{' '}
                {stats.totalTransactions === 1 ? 'transacao' : 'transacoes'}
                {stats.monthTransactions > 0 ? ` — ${stats.monthTransactions} so neste mes.` : '.'}
              </Text>
              {stats.monthExpense > 0 ? (
                <Text style={styles.statsText}>
                  Suas despesas do mes somam {formatCurrencyBRL(stats.monthExpense)}. Desbloqueie os
                  recursos do {intermediate.name} para aproveitar ao maximo esses dados.
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={styles.benefits}>
            {intermediate.benefits.map((benefit) => (
              <View key={benefit} style={styles.benefitRow}>
                <CheckCircle2 size={16} color={colors.success} />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>

          {currentPlan.trial.isEligible ? (
            <Pressable
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              onPress={handleStartTrial}
              disabled={startTrial.isPending}
            >
              {startTrial.isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Experimentar gratis por {TRIAL_DURATION_DAYS} dias
                </Text>
              )}
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              currentPlan.trial.isEligible ? styles.secondaryButton : styles.primaryButton,
              pressed && styles.pressed,
            ]}
            onPress={handleSeePlans}
          >
            <Text
              style={
                currentPlan.trial.isEligible ? styles.secondaryButtonText : styles.primaryButtonText
              }
            >
              Ver planos
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.dismissButton, pressed && styles.pressed]}
            onPress={onClose}
          >
            <Text style={styles.dismissText}>Agora nao</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
      alignItems: 'center',
    },
    iconWrapper: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...typography.h1,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    statsCard: {
      width: '100%',
      gap: spacing.xs,
      borderRadius: radius.lg,
      backgroundColor: colors.primarySoft,
      padding: spacing.lg,
    },
    statsHighlight: {
      ...typography.body,
      color: colors.primary,
      fontWeight: '800',
      lineHeight: 20,
    },
    statsText: {
      ...typography.caption,
      color: colors.primary,
      lineHeight: 18,
    },
    benefits: {
      width: '100%',
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
      lineHeight: 19,
    },
    primaryButton: {
      width: '100%',
      minHeight: 48,
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '800',
    },
    secondaryButton: {
      width: '100%',
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '800',
    },
    dismissButton: {
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    dismissText: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.85,
    },
  });
