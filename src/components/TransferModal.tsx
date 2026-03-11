import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { AccountBalanceSnapshot, CreateTransferInput } from '../features/accounts/types';
import { colors, radius, spacing, typography } from '../theme';

type TransferModalProps = {
  visible: boolean;
  accounts: AccountBalanceSnapshot[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTransferInput) => Promise<void> | void;
};

export function TransferModal({
  visible,
  accounts,
  submitting = false,
  onClose,
  onSubmit,
}: TransferModalProps) {
  const [amount, setAmount] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  const activeAccounts = useMemo(() => accounts.filter((account) => account.isActive), [accounts]);

  useEffect(() => {
    if (!visible) {
      setAmount('');
      setFromAccountId(activeAccounts[0]?.id ?? '');
      setToAccountId(activeAccounts[1]?.id ?? activeAccounts[0]?.id ?? '');
      return;
    }

    setFromAccountId((current) => current || activeAccounts[0]?.id || '');
    setToAccountId((current) => current || activeAccounts[1]?.id || activeAccounts[0]?.id || '');
  }, [activeAccounts, visible]);

  const handleSubmit = async () => {
    await onSubmit({
      fromAccountId,
      toAccountId,
      amount: Number(amount.replace(/\./g, '').replace(',', '.') || 0),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Transferir saldo</Text>
          <Text style={styles.subtitle}>As duas pontas vao refletir no banco de dados.</Text>

          <TextInput
            placeholder="Valor"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Origem</Text>
          <View style={styles.chips}>
            {activeAccounts.map((account) => (
              <Pressable
                key={`from-${account.id}`}
                onPress={() => setFromAccountId(account.id)}
                style={[styles.chip, fromAccountId === account.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, fromAccountId === account.id && styles.chipTextActive]}>
                  {account.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Destino</Text>
          <View style={styles.chips}>
            {activeAccounts.map((account) => (
              <Pressable
                key={`to-${account.id}`}
                onPress={() => setToAccountId(account.id)}
                disabled={account.id === fromAccountId}
                style={[
                  styles.chip,
                  toAccountId === account.id && styles.chipActive,
                  account.id === fromAccountId && styles.chipDisabled,
                ]}
              >
                <Text style={[styles.chipText, toAccountId === account.id && styles.chipTextActive]}>
                  {account.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, (!amount || fromAccountId === toAccountId || submitting) && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={!amount || fromAccountId === toAccountId || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Transferir</Text>
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
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
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
  chipDisabled: {
    opacity: 0.35,
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
