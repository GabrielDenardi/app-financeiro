import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from './AuthButton';
import { AuthScaffold } from './AuthScaffold';
import { InlineMessage } from './InlineMessage';
import { authTheme } from '../../../theme/authTheme';

type AuthCallbackResultProps = {
  variant: 'success' | 'error';
  title: string;
  message: string;
  actionLabel: string;
  onContinue: () => void;
};

export function AuthCallbackResult({
  variant,
  title,
  message,
  actionLabel,
  onContinue,
}: AuthCallbackResultProps) {
  return (
    <AuthScaffold
      title={title}
      subtitle={message}
      scrollable={false}
      footer={<PrimaryButton title={actionLabel} onPress={onContinue} />}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.badge,
            variant === 'success' ? styles.successBadge : styles.errorBadge,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              variant === 'success' ? styles.successText : styles.errorText,
            ]}
          >
            {variant === 'success' ? 'E-mail confirmado' : 'Não foi possível confirmar'}
          </Text>
        </View>

        <InlineMessage
          variant={variant === 'success' ? 'success' : 'error'}
          message={
            variant === 'success'
              ? 'Seu cadastro foi validado. Agora você já pode continuar no aplicativo.'
              : 'Tente abrir novamente o link mais recente enviado por e-mail ou solicite um novo envio.'
          }
        />
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 18,
    justifyContent: 'center',
  },
  badge: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  successBadge: {
    borderColor: 'rgba(22, 163, 74, 0.24)',
    backgroundColor: 'rgba(22, 163, 74, 0.08)',
  },
  errorBadge: {
    borderColor: 'rgba(220, 38, 38, 0.24)',
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  badgeText: {
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
  },
  successText: {
    color: authTheme.colors.success,
  },
  errorText: {
    color: authTheme.colors.danger,
  },
});
