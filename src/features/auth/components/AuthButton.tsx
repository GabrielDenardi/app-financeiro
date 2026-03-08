import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { authTheme } from '../../../theme/authTheme';

type AuthButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ title, onPress, disabled, loading, style }: AuthButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.baseButton,
        styles.primaryButton,
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressedButton,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={authTheme.colors.white} />
      ) : (
        <Text style={styles.primaryText}>{title}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, disabled, loading, style }: AuthButtonProps) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.baseButton,
        styles.secondaryButton,
        isDisabled && styles.disabledButton,
        pressed && !isDisabled && styles.pressedButton,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={authTheme.colors.brand} />
      ) : (
        <Text style={styles.secondaryText}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    minHeight: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButton: {
    backgroundColor: authTheme.colors.brand,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: authTheme.colors.brand,
    backgroundColor: authTheme.colors.surface,
  },
  disabledButton: {
    opacity: 0.55,
  },
  pressedButton: {
    opacity: 0.88,
  },
  primaryText: {
    color: authTheme.colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryText: {
    color: authTheme.colors.brand,
    fontSize: 16,
    fontWeight: '700',
  },
});

