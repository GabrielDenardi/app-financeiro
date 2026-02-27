import { StyleSheet, Text, View } from 'react-native';

import { authTheme } from '../../../theme/authTheme';

type InlineMessageProps = {
  message: string;
  variant?: 'error' | 'info' | 'success';
};

type VariantStyle = {
  container: object;
  text: object;
};

const variantStyles: Record<NonNullable<InlineMessageProps['variant']>, VariantStyle> = {
  error: {
    container: {
      borderColor: 'rgba(198, 40, 40, 0.28)',
      backgroundColor: 'rgba(198, 40, 40, 0.08)',
    },
    text: {
      color: authTheme.colors.danger,
    },
  },
  success: {
    container: {
      borderColor: 'rgba(27, 138, 75, 0.3)',
      backgroundColor: 'rgba(27, 138, 75, 0.08)',
    },
    text: {
      color: authTheme.colors.success,
    },
  },
  info: {
    container: {
      borderColor: 'rgba(92, 37, 122, 0.3)',
      backgroundColor: 'rgba(92, 37, 122, 0.08)',
    },
    text: {
      color: authTheme.colors.info,
    },
  },
};

export function InlineMessage({ message, variant = 'error' }: InlineMessageProps) {
  const style = variantStyles[variant];

  return (
    <View style={[styles.container, style.container]}>
      <Text style={[styles.text, style.text]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});

