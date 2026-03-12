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
import { ArrowLeftRight, RefreshCw, X } from 'lucide-react-native';

import type { AccountBalanceSnapshot, CreateTransferInput } from '../features/accounts/types';
import { colors, spacing, typography } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type TransferModalProps = {
  visible: boolean;
  accounts: AccountBalanceSnapshot[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTransferInput) => Promise<void> | void;
};

function parseCurrencyInput(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.') || 0);
}

export function TransferModal({
  visible,
  accounts,
  submitting = false,
  onClose,
  onSubmit,
}: TransferModalProps) {
  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.isActive),
    [accounts],
  );
  const [amount, setAmount] = useState('');
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const resetForm = useCallback(() => {
    setAmount('');
    setFromAccountId(activeAccounts[0]?.id ?? '');
    setToAccountId(activeAccounts[1]?.id ?? activeAccounts[0]?.id ?? '');
    fadeAnim.setValue(0);
    translateY.setValue(SCREEN_HEIGHT);
  }, [activeAccounts, fadeAnim, translateY]);

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
      if (!fromAccountId) {
        setFromAccountId(activeAccounts[0]?.id ?? '');
      }
      if (!toAccountId) {
        setToAccountId(activeAccounts[1]?.id ?? activeAccounts[0]?.id ?? '');
      }
      animateIn();
      return;
    }

    resetForm();
  }, [activeAccounts, animateIn, fromAccountId, resetForm, toAccountId, visible]);

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

  const selectedFrom = activeAccounts.find((account) => account.id === fromAccountId);
  const selectedTo = activeAccounts.find((account) => account.id === toAccountId);

  const handleTransfer = async () => {
    await onSubmit({
      fromAccountId,
      toAccountId,
      amount: parseCurrencyInput(amount),
    });
  };

  const swapAccounts = () => {
    setFromAccountId(toAccountId);
    setToAccountId(fromAccountId);
  };

  const saveDisabled =
    !amount.trim() || !fromAccountId || !toAccountId || fromAccountId === toAccountId || submitting;

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
                  <Text style={styles.title}>Transferencia</Text>
                  <Text style={styles.subtitle}>Mover saldo entre suas contas</Text>
                </View>
                <TouchableOpacity onPress={requestClose} style={styles.closeButton}>
                  <X size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView bounces={false} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <View style={styles.transferFlowCard}>
                <View style={styles.flowItem}>
                  <Text style={styles.flowLabel}>De (Origem)</Text>
                  <Text style={styles.flowAccountName} numberOfLines={1}>
                    {selectedFrom?.name || 'Selecionar'}
                  </Text>
                </View>

                <TouchableOpacity onPress={swapAccounts} style={styles.swapButton} activeOpacity={0.75}>
                  <ArrowLeftRight size={18} color={colors.primary} />
                </TouchableOpacity>

                <View style={[styles.flowItem, styles.flowItemRight]}>
                  <Text style={styles.flowLabel}>Para (Destino)</Text>
                  <Text style={[styles.flowAccountName, styles.rightText]} numberOfLines={1}>
                    {selectedTo?.name || 'Selecionar'}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Conta de Saida</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {activeAccounts.map((account) => (
                  <TouchableOpacity
                    key={`from-${account.id}`}
                    onPress={() => setFromAccountId(account.id)}
                    style={[
                      styles.accountChip,
                      fromAccountId === account.id && styles.accountChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.accountChipText,
                        fromAccountId === account.id && styles.accountChipTextActive,
                      ]}
                    >
                      {account.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionLabel}>Conta de Entrada</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {activeAccounts.map((account) => {
                  const disabled = account.id === fromAccountId;
                  const selected = toAccountId === account.id;

                  return (
                    <TouchableOpacity
                      key={`to-${account.id}`}
                      onPress={() => setToAccountId(account.id)}
                      disabled={disabled}
                      style={[
                        styles.accountChip,
                        selected && styles.accountChipActive,
                        disabled && styles.accountDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.accountChipText,
                          selected && styles.accountChipTextActive,
                        ]}
                      >
                        {account.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Quanto deseja transferir?</Text>
                <View style={styles.amountContainer}>
                  <Text style={styles.currencyPrefix}>R$</Text>
                  <TextInput
                    placeholder="0,00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                    maxLength={10}
                    style={styles.amountInput}
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
              </View>

              <View style={styles.bottomSpacer} />
            </ScrollView>

            <View style={styles.fixedFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={requestClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveButton, saveDisabled && styles.disabledButton]}
                onPress={handleTransfer}
                disabled={saveDisabled}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <RefreshCw size={18} color={colors.white} style={styles.refreshIcon} />
                    <Text style={styles.saveButtonText}>Confirmar</Text>
                  </>
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
  transferFlowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  flowItem: {
    flex: 1,
  },
  flowItemRight: {
    alignItems: 'flex-end',
  },
  flowLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  flowAccountName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  rightText: {
    textAlign: 'right',
  },
  swapButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
    borderColor: '#D0DBFF',
    borderWidth: 1,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  horizontalScroll: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  accountChip: {
    paddingHorizontal: 16,
    height: 40,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  accountChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: colors.primary,
  },
  accountDisabled: {
    opacity: 0.4,
  },
  accountChipText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  accountChipTextActive: {
    color: colors.primary,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  inputLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  currencyPrefix: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.textPrimary,
    marginRight: 8,
  },
  amountInput: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
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
    flexDirection: 'row',
  },
  disabledButton: {
    opacity: 0.5,
  },
  refreshIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 140,
  },
});
