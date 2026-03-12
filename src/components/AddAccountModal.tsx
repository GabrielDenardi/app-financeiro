import { useCallback, useEffect, useRef, useState } from 'react';
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
import { Banknote, Building2, Check, PiggyBank, TrendingUp, Wallet, X } from 'lucide-react-native';

import type { AccountType, CreateAccountInput } from '../features/accounts/types';
import { colors, radius, spacing, typography } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ACCOUNT_TYPES: Array<{
  value: AccountType;
  label: string;
  icon: typeof Wallet;
}> = [
  { value: 'checking', label: 'Corrente', icon: Wallet },
  { value: 'savings', label: 'Poupanca', icon: PiggyBank },
  { value: 'investment', label: 'Investimento', icon: TrendingUp },
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
  { value: 'other', label: 'Outros', icon: Building2 },
];

const POPULAR_BANKS = [
  { id: 'nubank', name: 'Nubank', color: '#8A05BE' },
  { id: 'inter', name: 'Inter', color: '#FF7A00' },
  { id: 'itau', name: 'Itau', color: '#EC7000' },
  { id: 'bradesco', name: 'Bradesco', color: '#CC092F' },
  { id: 'santander', name: 'Santander', color: '#EC0000' },
  { id: 'c6', name: 'C6 Bank', color: '#212121' },
];

type AddAccountModalProps = {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateAccountInput) => Promise<void> | void;
};

function parseCurrencyInput(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.') || 0);
}

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
  const [selectedColor, setSelectedColor] = useState<string>(colors.primaryLight);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const resetForm = useCallback(() => {
    setName('');
    setInstitution('');
    setOpeningBalance('');
    setType('checking');
    setSelectedColor(colors.primaryLight);
    fadeAnim.setValue(0);
    translateY.setValue(SCREEN_HEIGHT);
  }, [fadeAnim, translateY]);

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
      animateIn();
      return;
    }

    resetForm();
  }, [animateIn, resetForm, visible]);

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

  const handleSubmit = async () => {
    await onSubmit({
      name: name.trim(),
      institution: institution.trim(),
      type,
      openingBalance: parseCurrencyInput(openingBalance),
      color: selectedColor,
    });
  };

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
                  <Text style={styles.title}>Nova Conta</Text>
                  <Text style={styles.subtitle}>Configure os detalhes da conta</Text>
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
              <Text style={styles.sectionLabel}>Tipo de Conta</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
              >
                {ACCOUNT_TYPES.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setType(option.value)}
                    style={[styles.typeItem, type === option.value && styles.typeItemActive]}
                  >
                    <option.icon
                      size={18}
                      color={type === option.value ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[styles.typeLabel, type === option.value && styles.typeLabelActive]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionLabel}>Instituicoes Populares</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
              >
                {POPULAR_BANKS.map((bank) => {
                  const selected = institution === bank.name;

                  return (
                    <TouchableOpacity
                      key={bank.id}
                      onPress={() => {
                        setInstitution(bank.name);
                        setSelectedColor(bank.color);
                        setName((current) => current || bank.name);
                      }}
                      style={[
                        styles.bankChip,
                        selected && {
                          borderColor: bank.color,
                          backgroundColor: `${bank.color}10`,
                        },
                      ]}
                    >
                      <View style={[styles.bankDot, { backgroundColor: bank.color }]} />
                      <Text style={styles.bankChipText}>{bank.name}</Text>
                      {selected ? <Check size={14} color={bank.color} style={styles.checkIcon} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.inputCard}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Apelido</Text>
                  <TextInput
                    placeholder="Ex: Minha Carteira"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                    textAlign="right"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
                <View style={styles.divider} />

                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Instituicao</Text>
                  <TextInput
                    placeholder="Ex: Nubank"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                    textAlign="right"
                    value={institution}
                    onChangeText={setInstitution}
                  />
                </View>
                <View style={styles.divider} />

                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Saldo Inicial</Text>
                  <View style={styles.amountInputRow}>
                    <Text style={styles.currencyPrefix}>R$</Text>
                    <TextInput
                      placeholder="0,00"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      style={styles.amountInput}
                      value={openingBalance}
                      onChangeText={setOpeningBalance}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.bottomSpacer} />
            </ScrollView>

            <View style={styles.fixedFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={requestClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, (!name.trim() || submitting) && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={!name.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Criar Conta</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
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
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: 100,
  },
  gestureCapture: {
    paddingTop: 12,
    backgroundColor: colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    zIndex: 10,
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
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  horizontalScroll: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  typeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  typeItemActive: {
    borderColor: colors.primary,
    backgroundColor: '#EEF2FF',
  },
  typeLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  typeLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  bankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 44,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  bankDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bankChipText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 4,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 56,
    gap: spacing.md,
  },
  inputLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  textInput: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currencyPrefix: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  amountInput: {
    ...typography.body,
    color: colors.textPrimary,
    minWidth: 72,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  fixedFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    flexDirection: 'row',
    gap: spacing.md,
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
  saveButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 120,
  },
});
