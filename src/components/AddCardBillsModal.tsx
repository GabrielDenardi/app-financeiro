import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Check, ChevronRight, X } from 'lucide-react-native';

import type { CreditCard, RecordCardChargeInput } from '../features/cards/types';
import type { FinanceCategory } from '../features/transactions/types';
import { colors, typography } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const INSTALLMENT_OPTIONS = ['A vista', '2x', '3x', '4x', '5x', '6x', '7x', '8x', '9x', '10x', '11x', '12x'];

type AddCardBillsModalProps = {
  visible: boolean;
  cards: CreditCard[];
  categories: FinanceCategory[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: RecordCardChargeInput) => Promise<void> | void;
};

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '');
  const numeric = Number(digits || '0') / 100;

  return numeric.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCurrencyInput(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.') || 0);
}

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
  const [selectedCardId, setSelectedCardId] = useState(cards[0]?.id ?? '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    expenseCategories[0]?.id ?? null,
  );
  const [installment, setInstallment] = useState('A vista');
  const [purchaseDate, setPurchaseDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const resetForm = useCallback(() => {
    setTitle('');
    setAmount('');
    setSelectedCardId(cards[0]?.id ?? '');
    setSelectedCategoryId(expenseCategories[0]?.id ?? null);
    setInstallment('A vista');
    setPurchaseDate(new Date());
    setShowDatePicker(false);
    setNotes('');
    fadeAnim.setValue(0);
    translateY.setValue(SCREEN_HEIGHT);
  }, [cards, expenseCategories, fadeAnim, translateY]);

  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, translateY]);

  const requestClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SCREEN_HEIGHT, duration: 280, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        onClose();
      }
    });
  }, [fadeAnim, onClose, translateY]);

  useEffect(() => {
    if (visible) {
      if (!selectedCardId) {
        setSelectedCardId(cards[0]?.id ?? '');
      }
      if (!selectedCategoryId) {
        setSelectedCategoryId(expenseCategories[0]?.id ?? null);
      }
      animateIn();
      return;
    }

    resetForm();
  }, [animateIn, cards, expenseCategories, resetForm, selectedCardId, selectedCategoryId, visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120) {
          requestClose();
          return;
        }

        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  const selectedCard = cards.find((card) => card.id === selectedCardId);
  const selectedCategory = expenseCategories.find((category) => category.id === selectedCategoryId);

  const installmentCount = installment === 'A vista' ? 1 : Number(installment.replace('x', '')) || 1;
  const numericAmount = parseCurrencyInput(amount);

  const handleSave = async () => {
    await onSubmit({
      cardId: selectedCardId,
      title: title.trim(),
      totalAmount: numericAmount,
      categoryId: selectedCategoryId,
      purchaseDate: purchaseDate.toISOString().slice(0, 10),
      installmentCount,
      notes: notes.trim() || undefined,
    });
  };

  const renderInstallmentSchedule = () => {
    if (installmentCount <= 1 || !numericAmount) {
      return null;
    }

    const installmentValue = numericAmount / installmentCount;

    return (
      <View style={styles.installmentContainer}>
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Valor total</Text>
            <Text style={styles.summaryValueBold}>R$ {amount}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Por parcela</Text>
            <Text style={styles.summaryValueBlue}>
              {installmentCount}x de R${' '}
              {installmentValue.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Text>
          </View>
        </View>
        <Text style={styles.scheduleTitle}>Cronograma</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scheduleScroll}>
          {Array.from({ length: installmentCount }).map((_, index) => {
            const dueDate = new Date(purchaseDate);
            dueDate.setMonth(purchaseDate.getMonth() + index);
            const monthLabel = dueDate
              .toLocaleString('pt-BR', { month: 'short' })
              .replace('.', '')
              .concat(`/${String(dueDate.getFullYear()).slice(-2)}`);

            return (
              <View key={`${monthLabel}-${index + 1}`} style={styles.scheduleCard}>
                <Text style={styles.scheduleNumber}>
                  {index + 1}/{installmentCount}
                </Text>
                <Text style={styles.scheduleValue}>
                  R${' '}
                  {installmentValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
                <Text style={styles.scheduleMonth}>{monthLabel}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const saveDisabled =
    !title.trim() || !amount.trim() || !selectedCardId || !selectedCategoryId || submitting;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={requestClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={requestClose} />
        </Animated.View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            <View {...panResponder.panHandlers} style={styles.gestureCapture}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>Lancar Despesa</Text>
                  <Text style={styles.subtitle}>Registre um gasto no seu cartao</Text>
                </View>
                <TouchableOpacity onPress={requestClose} style={styles.closeButton}>
                  <X size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              bounces={false}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.inputLabel}>Escolha o Cartao</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {cards.map((card) => {
                  const selected = selectedCardId === card.id;

                  return (
                    <TouchableOpacity
                      key={card.id}
                      onPress={() => setSelectedCardId(card.id)}
                      style={[
                        styles.cardChip,
                        selected && {
                          borderColor: card.color,
                          backgroundColor: `${card.color}10`,
                        },
                      ]}
                    >
                      <View style={[styles.cardDot, { backgroundColor: card.color }]} />
                      <Text
                        style={[
                          styles.cardChipName,
                          selected && { color: card.color },
                        ]}
                      >
                        {card.name}
                      </Text>
                      {selected ? <Check size={14} color={card.color} style={styles.checkIcon} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.mainCard}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Valor</Text>
                  <TextInput
                    placeholder="R$ 0,00"
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={(text) => setAmount(formatCurrencyInput(text))}
                  />
                </View>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.infoRow} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.infoLabel}>Data</Text>
                  <View style={styles.valueWithIcon}>
                    <Text style={styles.infoValue}>{purchaseDate.toLocaleDateString('pt-BR')}</Text>
                    <ChevronRight size={18} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.mutedCard}>
                <Text style={styles.mutedCardHeader}>Detalhes da Fatura</Text>
                <Text style={styles.sectionLabelMini}>Categoria</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniChipScroll}>
                  {expenseCategories.map((category) => {
                    const selected = selectedCategoryId === category.id;

                    return (
                      <TouchableOpacity
                        key={category.id}
                        onPress={() => setSelectedCategoryId(category.id)}
                        style={[
                          styles.miniChip,
                          selected && {
                            backgroundColor: `${category.color}20`,
                            borderColor: category.color,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.miniChipText,
                            selected && { color: category.color, fontWeight: '700' },
                          ]}
                        >
                          {category.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.sectionLabelMini, styles.installmentLabel]}>Parcelas</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniChipScroll}>
                  {INSTALLMENT_OPTIONS.map((option) => {
                    const selected = installment === option;

                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setInstallment(option)}
                        style={[
                          styles.miniChip,
                          selected && {
                            borderColor: colors.primaryLight,
                            backgroundColor: '#EFF6FF',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.miniChipText,
                            selected && {
                              color: colors.primaryLight,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {renderInstallmentSchedule()}

              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionHeader}>Descricao</Text>
                <TextInput
                  multiline
                  placeholder="Adicione uma descricao..."
                  placeholderTextColor={colors.textSecondary}
                  style={styles.descriptionInput}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionHeader}>Observacoes</Text>
                <TextInput
                  multiline
                  placeholder="Opcional"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.descriptionInput}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>

              <View style={styles.bottomSpacer} />
            </ScrollView>

            <View style={styles.fixedFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={requestClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, saveDisabled && styles.disabledButton]}
                onPress={handleSave}
                disabled={saveDisabled}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>

        {showDatePicker ? (
          <DateTimePicker
            value={purchaseDate}
            mode="date"
            display="default"
            onChange={(_event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) {
                setPurchaseDate(selectedDate);
              }
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  backdropTouch: {
    flex: 1,
  },
  keyboardWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: SCREEN_HEIGHT * 0.9,
    minHeight: 100,
  },
  gestureCapture: {
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    zIndex: 5,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    paddingHorizontal: 24,
  },
  inputLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  horizontalScroll: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  cardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  cardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  cardChipName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 8,
  },
  mainCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  amountInput: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: colors.textPrimary,
    minWidth: 120,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  valueWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  mutedCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 16,
  },
  mutedCardHeader: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionLabelMini: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  installmentLabel: {
    marginTop: 16,
  },
  miniChipScroll: {
    marginTop: 12,
  },
  miniChip: {
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    marginRight: 8,
  },
  miniChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  installmentContainer: {
    marginTop: 16,
  },
  summaryBox: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  summaryValueBold: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  summaryValueBlue: {
    ...typography.body,
    color: colors.primaryLight,
    fontWeight: '700',
  },
  scheduleTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
  },
  scheduleScroll: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  scheduleCard: {
    width: 120,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
  },
  scheduleNumber: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  scheduleValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 8,
  },
  scheduleMonth: {
    ...typography.caption,
    color: colors.primaryLight,
    fontWeight: '700',
    marginTop: 8,
  },
  descriptionContainer: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 16,
  },
  descriptionHeader: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 12,
  },
  descriptionInput: {
    minHeight: 96,
    textAlignVertical: 'top',
    ...typography.body,
    color: colors.textPrimary,
  },
  fixedFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  bottomSpacer: {
    height: 140,
  },
});
