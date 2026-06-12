import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CheckCircle2, Lock } from 'lucide-react-native';

import { useAuthenticatedUser } from '../../auth/hooks/useAuthenticatedUser';
import { useCurrentPlan } from '../hooks';
import { isFreePlan } from '../plans';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../../../theme';

const PREMIUM_HIGHLIGHTS = [
  'Cartoes de credito com controle de faturas e parcelas',
  'Orcamentos, metas e relatorios completos',
  'Grupos para dividir despesas com outras pessoas',
];

type PremiumGateProps = {
  featureTitle: string;
  description?: string;
  children: ReactNode;
};

/**
 * Bloqueia features pagas para usuarios do plano Free, exibindo um paywall
 * com chamada para a tela de planos no lugar do conteudo.
 */
export function PremiumGate({ featureTitle, description, children }: PremiumGateProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const user = useAuthenticatedUser();
  const currentPlan = useCurrentPlan(user?.id);

  if (currentPlan.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryLight} />
      </View>
    );
  }

  if (currentPlan.isError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.subtitle}>Não foi possível validar seu plano agora.</Text>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, styles.retryButton, pressed && styles.pressed]}
          onPress={() => { void currentPlan.refetch(); }}
        >
          <Text style={styles.primaryButtonText}>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }

  if (!isFreePlan(currentPlan.plan.id)) {
    return <>{children}</>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrapper}>
          <Lock size={28} color={colors.primary} />
        </View>

        <Text style={styles.title}>{featureTitle}</Text>
        <Text style={styles.subtitle}>
          {description ??
            `${featureTitle} esta disponivel apenas nos planos pagos. Assine para desbloquear esse e outros recursos.`}
        </Text>

        <View style={styles.highlights}>
          {PREMIUM_HIGHLIGHTS.map((highlight) => (
            <View key={highlight} style={styles.highlightRow}>
              <CheckCircle2 size={16} color={colors.success} />
              <Text style={styles.highlightText}>{highlight}</Text>
            </View>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate('Plans')}
        >
          <Text style={styles.primaryButtonText}>Conhecer os planos</Text>
        </Pressable>

        {navigation.canGoBack() ? (
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.secondaryButtonText}>Voltar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    content: {
      width: '100%',
      maxWidth: 360,
      alignItems: 'center',
      gap: spacing.md,
    },
    iconWrapper: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
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
    highlights: {
      width: '100%',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      padding: spacing.lg,
      marginVertical: spacing.sm,
    },
    highlightRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    highlightText: {
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
    retryButton: {
      marginTop: spacing.md,
    },
    primaryButtonText: {
      ...typography.body,
      color: colors.white,
      fontWeight: '800',
    },
    secondaryButton: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    secondaryButtonText: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.85,
    },
  });
