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

import type { CreateCardInput } from '../features/cards/types';
import { colors, radius, spacing, typography } from '../theme';

const NETWORKS = ['Visa', 'Mastercard', 'Elo'];
const CARD_COLORS = ['#8A05BE', '#FF7A00', '#1E3A8A', '#DC2626', '#16A34A', '#0F172A'];

type AddCardModalProps = {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateCardInput) => Promise<void> | void;
};

export function AddCardModal({
  visible,
  submitting = false,
  onClose,
  onSubmit,
}: AddCardModalProps) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [network, setNetwork] = useState('Visa');
  const [limitAmount, setLimitAmount] = useState('');
  const [lastDigits, setLastDigits] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [color, setColor] = useState(CARD_COLORS[0]);

  useEffect(() => {
    if (!visible) {
      setName('');
      setInstitution('');
      setNetwork('Visa');
      setLimitAmount('');
      setLastDigits('');
      setDueDay('');
      setClosingDay('');
      setColor(CARD_COLORS[0]);
    }
  }, [visible]);

  const handleSubmit = async () => {
    await onSubmit({
      name,
      institution,
      network,
      lastDigits,
      limitAmount: Number(limitAmount.replace(/\./g, '').replace(',', '.') || 0),
      dueDay: Number(dueDay),
      closingDay: Number(closingDay),
      color,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Novo cartao</Text>
          <Text style={styles.subtitle}>Limite, fechamento e vencimento vao virar dados reais.</Text>

          <TextInput
            placeholder="Nome do cartao"
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
            placeholder="Ultimos 4 digitos"
            value={lastDigits}
            onChangeText={setLastDigits}
            keyboardType="number-pad"
            maxLength={4}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            placeholder="Limite total"
            value={limitAmount}
            onChangeText={setLimitAmount}
            keyboardType="decimal-pad"
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />

          <View style={styles.row}>
            <TextInput
              placeholder="Vencimento"
              value={dueDay}
              onChangeText={setDueDay}
              keyboardType="number-pad"
              style={[styles.input, styles.halfInput]}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              placeholder="Fechamento"
              value={closingDay}
              onChangeText={setClosingDay}
              keyboardType="number-pad"
              style={[styles.input, styles.halfInput]}
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.chips}>
            {NETWORKS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setNetwork(option)}
                style={[styles.chip, network === option && styles.chipActive]}
              >
                <Text style={[styles.chipText, network === option && styles.chipTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.colorsRow}>
            {CARD_COLORS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setColor(option)}
                style={[styles.colorCircle, { backgroundColor: option }, color === option && styles.colorCircleActive]}
              />
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
  row: {
    flexDirection: 'row',
    gap: spacing.md,
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
  halfInput: {
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
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
  colorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorCircleActive: {
    borderWidth: 2,
    borderColor: colors.textPrimary,
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
