import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { authTheme } from '../../../theme/authTheme';

type AuthScaffoldProps = {
  title: string;
  subtitle?: string;
  progress?: number;
  onBack?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  scrollable?: boolean;
};

export function AuthScaffold({
  title,
  subtitle,
  progress,
  onBack,
  children,
  footer,
  scrollable = true,
}: AuthScaffoldProps) {
  const body = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.staticContent}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.headerArea}>
          <View style={styles.headerRow}>
            {onBack ? (
              <Pressable onPress={onBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <Ionicons name="chevron-back" size={24} color={authTheme.colors.textPrimary} />
              </Pressable>
            ) : (
              <View style={styles.backButtonPlaceholder} />
            )}
          </View>
          {typeof progress === 'number' ? (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(0, Math.min(1, progress)) * 100}%` },
                ]}
              />
            </View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        <View style={styles.contentArea}>{body}</View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: authTheme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: authTheme.colors.background,
  },
  headerArea: {
    paddingHorizontal: 20,
    paddingTop: Platform.select({
      android: 36,
      default: 10,
    }),
    gap: 14,
  },
  headerRow: {
    minHeight: 38,
    justifyContent: 'center',
  },
  backButton: {
    width: 30,
    height: 30,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 30,
    height: 30,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    borderRadius: 10,
    backgroundColor: authTheme.colors.brandMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 10,
    backgroundColor: authTheme.colors.brand,
  },
  title: {
    color: authTheme.colors.textPrimary,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: authTheme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
  },
  scrollContent: {
    paddingBottom: 24,
    gap: 18,
  },
  staticContent: {
    flex: 1,
    gap: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: authTheme.colors.background,
  },
  pressed: {
    opacity: 0.65,
  },
});
