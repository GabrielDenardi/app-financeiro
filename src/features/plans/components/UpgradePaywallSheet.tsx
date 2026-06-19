import { useMemo } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { CheckCircle2, Lock } from 'lucide-react-native';

import { useAuthenticatedUser } from '../../auth/hooks/useAuthenticatedUser';
import type { AppStackParamList } from '../../../navigation/types';
import { formatCurrencyBRL } from '../../../utils/format';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../../../theme';
import { BottomSheet } from '../../../components/BottomSheet';
import { Button } from '../../../components/Button';
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      headerAlign="center"
      showClose={false}
      headerIcon={
        <View style={styles.iconWrapper}>
          <Lock size={26} color={colors.primary} />
        </View>
      }
      title={featureTitle}
      subtitle={description ?? `${featureTitle} nao esta incluido no seu plano atual.`}
      maxHeightRatio={0.85}
    >
      {(close) => (
        <View style={styles.body}>
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

          <View style={styles.actions}>
            {currentPlan.trial.isEligible ? (
              <Button
                label={`Experimentar gratis por ${TRIAL_DURATION_DAYS} dias`}
                onPress={handleStartTrial}
                loading={startTrial.isPending}
              />
            ) : null}

            <Button
              label="Ver planos"
              variant={currentPlan.trial.isEligible ? 'secondary' : 'primary'}
              onPress={handleSeePlans}
            />

            <Button label="Agora nao" variant="ghost" size="md" onPress={close} />
          </View>
        </View>
      )}
    </BottomSheet>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    iconWrapper: {
      width: 56,
      height: 56,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      gap: spacing.md,
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
    actions: {
      gap: spacing.md,
      marginTop: spacing.sm,
    },
  });
