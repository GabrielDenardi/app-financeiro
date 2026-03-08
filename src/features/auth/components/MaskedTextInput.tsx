import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { authTheme } from '../../../theme/authTheme';

type MaskedTextInputProps = {
  label?: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  maxLength?: number;
  error?: string | null;
  helperText?: string;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  inputStyle?: StyleProp<TextStyle>;
};

export function MaskedTextInput({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  secureTextEntry = false,
  autoCapitalize = 'none',
  autoCorrect = false,
  maxLength,
  error,
  helperText,
  returnKeyType = 'done',
  onSubmitEditing,
  inputStyle,
}: MaskedTextInputProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={authTheme.colors.textSecondary}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        style={[styles.input, Boolean(error) && styles.inputError, inputStyle]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: authTheme.colors.textSecondary,
  },
  input: {
    minHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: authTheme.colors.border,
    color: authTheme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '400',
    letterSpacing: 0.2,
    paddingHorizontal: 0,
  },
  inputError: {
    borderBottomColor: authTheme.colors.danger,
  },
  helperText: {
    fontSize: 12,
    color: authTheme.colors.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: authTheme.colors.danger,
    fontWeight: '500',
  },
});
