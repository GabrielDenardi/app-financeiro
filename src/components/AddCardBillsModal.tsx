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

import type { CreditCard, RecordCardChargeInput } from '../features/cards/types';
import type { FinanceCategory } from '../features/transactions/types';
import { colors, radius, spacing, typography } from '../theme';

type AddCardBillsModalProps = {
  visible: boolean;
  cards: CreditCard[];
  categories: FinanceCategory[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: RecordCardChargeInput) => Promise<void> | void;
};

export function AddCardBillsModal({
  visible,
  cards,
  categories,
  submitting = false,
  onClose,
  onSubmit,
}: AddCardBillsModalProps) {
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind !== 'income'),
    [categories],
  );
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [cardId, setCardId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [installmentCount, setInstallmentCount] = useState('1');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setAmount('');
      setCardId(cards[0]?.id ?? '');
      setCategoryId(expenseCategories[0]?.id ?? null);
      setInstallmentCount('1');
      setPurchaseDate(new Date().toISOString().slice(0, 10));
      setNotes('');
      return;
    }

    setCardId((current) => current || cards[0]?.id || '');
    setCategoryId((current) => current || expenseCategories[0]?.id || null);
  }, [cards, expenseCategories, visible]);

  const handleSubmit = async () => {
    await onSubmit({
      cardId,
      title,
      totalAmount: Number(amount.replace(/\./g, '').replace(',', '.') || 0),
      categoryId,
      purchaseDate,
      installmentCount: Number(installmentCount) || 1,
      notes,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Lancar compra</Text>
          <Text style={styles.subtitle}>A compra vai gerar parcelas reais no Supabase.</Text>

          <TextInput
            placeholder="Descricao"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            placeholder="Valor total"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            placeholder="Data da compra (YYYY-MM-DD)"
            value={purchaseDate}
            onChangeText={setPurchaseDate}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            placeholder="Parcelas"
            value={installmentCount}
            onChangeText={setInstallmentCount}
            keyboardType="number-pad"
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />
          <TextInput
            placeholder="Observacoes"
            value={notes}
            onChangeText={setNotes}
            style={styles.input}
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={styles.label}>Cartao</Text>
          <View style={styles.chips}>
            {cards.map((card) => (
              <Pressable
                key={card.id}
                onPress={() => setCardId(card.id)}
                style={[styles.chip, cardId === card.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, cardId === card.id && styles.chipTextActive]}>
                  {card.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Categoria</Text>
          <View style={styles.chips}>
            {expenseCategories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => setCategoryId(category.id)}
                style={[styles.chip, categoryId === category.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, categoryId === category.id && styles.chipTextActive]}>
                  {category.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.primaryButton, (!title || !cardId || submitting) && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              disabled={!title || !cardId || submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryButtonText}>Salvar</Text>
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
