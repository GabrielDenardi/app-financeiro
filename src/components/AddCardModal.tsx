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
import { LinearGradient } from 'expo-linear-gradient';
import { Check, CreditCard, X } from 'lucide-react-native';

import type { CreateCardInput } from '../features/cards/types';
import { colors, radius, spacing, typography } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const POPULAR_BANKS = [
  { id: 'nubank', name: 'Nubank', color: '#8A05BE' },
  { id: 'inter', name: 'Inter', color: '#FF7A00' },
  { id: 'itau', name: 'Itau', color: '#EC7000' },
  { id: 'bradesco', name: 'Bradesco', color: '#CC092F' },
  { id: 'santander', name: 'Santander', color: '#EC0000' },
  { id: 'c6', name: 'C6 Bank', color: '#212121' },
];

const NETWORKS = ['Visa', 'Mastercard', 'Elo'];
const CARD_COLORS = ['#8A05BE', '#FF7A00', '#1E3A8A', '#DC2626', '#16A34A', '#0F172A'];

type AddCardModalProps = {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateCardInput) => Promise<void> | void;
};

function parseCurrencyInput(value: string) {
  return Number(value.replace(/\./g, '').replace(',', '.') || 0);
}

function gradientForColor(baseColor: string): [string, string] {
  if (baseColor === '#0F172A') {
    return ['#334155', '#0F172A'];
  }

  return [baseColor, `${baseColor}DD`];
}

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
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [cardColor, setCardColor] = useState(CARD_COLORS[0]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const resetForm = useCallback(() => {
    setName('');
    setInstitution('');
    setNetwork('Visa');
    setLimitAmount('');
    setLastDigits('');
    setClosingDay('');
    setDueDay('');
    setCardColor(CARD_COLORS[0]);
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
      network,
      lastDigits: lastDigits.trim(),
      limitAmount: parseCurrencyInput(limitAmount),
      dueDay: Number(dueDay) || 0,
      closingDay: Number(closingDay) || 0,
      color: cardColor,
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
                  <Text style={styles.title}>Novo Cartao</Text>
                  <Text style={styles.subtitle}>Configure os detalhes do seu cartao</Text>
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
              <View style={styles.previewContainer}>
                <LinearGradient
                  colors={gradientForColor(cardColor)}
                  style={styles.cardPreview}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.circleDecorationTop} />
                  <View style={styles.circleDecorationBottom} />

                  <View style={styles.cardHeaderPreview}>
                    <View>
                      <Text style={styles.cardPreviewInstLabel}>
                        {(institution || 'INSTITUICAO').toUpperCase()}
                      </Text>
                      <Text style={styles.cardPreviewNameText}>{name || 'Nome do Cartao'}</Text>
                    </View>
                    <Text style={styles.cardPreviewNetworkText}>{network}</Text>
                  </View>

                  <Text style={styles.cardPreviewDigitsText}>
                    ••••  ••••  ••••  {lastDigits || '****'}
                  </Text>

                  <View style={styles.cardPreviewFooter}>
                    <View>
                      <Text style={styles.cardFooterLabel}>VENCIMENTO</Text>
                      <Text style={styles.cardFooterValue}>DIA {dueDay || '--'}</Text>
                    </View>
                    <View style={styles.previewFooterRight}>
                      <Text style={styles.cardFooterLabel}>LIMITE TOTAL</Text>
                      <Text style={styles.cardFooterValue}>R$ {limitAmount || '0,00'}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>

              <Text style={styles.sectionLabel}>Cor do Cartao</Text>
              <View style={styles.colorRow}>
                {CARD_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorOption, { backgroundColor: color }]}
                    onPress={() => setCardColor(color)}
                  >
                    {cardColor === color ? <Check size={16} color={colors.white} /> : null}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.sectionLabel}>Instituicao</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
              >
                {POPULAR_BANKS.map((bank) => (
                  <TouchableOpacity
                    key={bank.id}
                    onPress={() => {
                      setInstitution(bank.name);
                      setCardColor(bank.color);
                      setName((current) => current || bank.name);
                    }}
                    style={[
                      styles.bankChip,
                      institution === bank.name && {
                        borderColor: bank.color,
                        backgroundColor: `${bank.color}10`,
                      },
                    ]}
                  >
                    <View style={[styles.bankDot, { backgroundColor: bank.color }]} />
                    <Text style={styles.bankChipText}>{bank.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionLabel}>Bandeira</Text>
              <View style={styles.networkRow}>
                {NETWORKS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    onPress={() => setNetwork(option)}
                    style={[styles.typeItem, network === option && styles.typeItemActive]}
                  >
                    <CreditCard
                      size={16}
                      color={network === option ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[styles.typeLabel, network === option && styles.typeLabelActive]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputCard}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Nome do Cartao</Text>
                  <TextInput
                    placeholder="Ex: Nubank Black"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                    textAlign="right"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
                <View style={styles.divider} />
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Ultimos 4 digitos</Text>
                  <TextInput
                    placeholder="0000"
                    keyboardType="number-pad"
                    maxLength={4}
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                    textAlign="right"
                    value={lastDigits}
                    onChangeText={setLastDigits}
                  />
                </View>
                <View style={styles.divider} />
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Limite Total</Text>
                  <TextInput
                    placeholder="0,00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                    textAlign="right"
                    value={limitAmount}
                    onChangeText={setLimitAmount}
                  />
                </View>
              </View>

              <View style={[styles.inputCard, styles.secondInputCard]}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Dia do Vencimento</Text>
                  <TextInput
                    placeholder="10"
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                    textAlign="right"
                    value={dueDay}
                    onChangeText={setDueDay}
                  />
                </View>
                <View style={styles.divider} />
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Dia do Fechamento</Text>
                  <TextInput
                    placeholder="03"
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholderTextColor={colors.textSecondary}
                    style={styles.textInput}
                    textAlign="right"
                    value={closingDay}
                    onChangeText={setClosingDay}
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
                style={[styles.saveButton, (!name.trim() || submitting) && styles.disabledButton]}
                onPress={handleSubmit}
                disabled={!name.trim() || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Criar Cartao</Text>
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
    maxHeight: SCREEN_HEIGHT * 0.9,
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
  previewContainer: {
    marginBottom: 24,
  },
  cardPreview: {
    height: 200,
    borderRadius: 28,
    padding: 20,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  circleDecorationTop: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -70,
    right: -35,
  },
  circleDecorationBottom: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -50,
    left: -20,
  },
  cardHeaderPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardPreviewInstLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.86)',
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardPreviewNameText: {
    ...typography.h2,
    color: colors.white,
    marginTop: spacing.sm,
  },
  cardPreviewNetworkText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  cardPreviewDigitsText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 2,
  },
  cardPreviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  previewFooterRight: {
    alignItems: 'flex-end',
  },
  cardFooterLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
  },
  cardFooterValue: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  horizontalScroll: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
    marginBottom: 24,
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
  networkRow: {
    flexDirection: 'row',
    gap: 8,
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
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  secondInputCard: {
    marginTop: 16,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
    gap: spacing.md,
    paddingHorizontal: 16,
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
    height: 140,
  },
});
