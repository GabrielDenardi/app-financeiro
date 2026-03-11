import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { AccountType, CreateAccountInput } from '../features/accounts/types';
import { colors, radius, spacing, typography } from '../theme';

const ACCOUNT_TYPES: Array<{ value: AccountType; label: string }> = [
  { value: 'checking', label: 'Corrente' },
  { value: 'savings', label: 'Poupanca' },
  { value: 'investment', label: 'Investimento' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'other', label: 'Outro' },
];

type AddAccountModalProps = {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAccountInput) => Promise<void> | void;
};

export function AddAccountModal({
  visible,
  submitting = false,
  onClose,
  onSubmit,
}: AddAccountModalProps) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [type, setType] = useState<AccountType>('checking');

  useEffect(() => {
    if (!visible) {
      setName('');
      setInstitution('');
      setOpeningBalance('');
      setType('checking');
    }
  }, [visible]);

  const handleSubmit = async () => {
    await onSubmit({
      name,
      institution,
      type,
      openingBalance: Number(openingBalance.replace(/\./g, '').replace(',', '.') || 0),
      color: '#2563EB',
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Nova conta</Text>
          <Text style={styles.subtitle}>Crie uma conta real vinculada ao seu backend.</Text>

          <TextInput
            placeholder="Nome da conta"
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            placeholder="Instituicao"
            value={institution}
            onChangeText={setInstitution}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            placeholder="Saldo inicial"
            value={openingBalance}
            onChangeText={setOpeningBalance}
            keyboardType="decimal-pad"
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />

          <View style={styles.chips}>
            {ACCOUNT_TYPES.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setType(option.value)}
                style={[styles.chip, type === option.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, type === option.value && styles.chipTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, (!name || submitting) && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={!name || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Criar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.primary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
});
