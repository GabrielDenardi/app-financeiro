import React, { useState, useCallback, useMemo } from 'react';
import { 
  Modal, View, Text, StyleSheet, 
  TextInput, ScrollView, TouchableOpacity, Dimensions,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard
} from 'react-native';
import { X, AlignLeft, Calendar, ChevronRight, Check } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, radius, typography } from '../theme';
import { Props } from '../types/finance';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const AVAILABLE_CARDS = [
  { id: '1', name: 'Nubank Principal', color: '#8A05BE', lastDigits: '8721' },
  { id: '2', name: 'Inter Gold', color: '#FF7A00', lastDigits: '4432' },
  { id: '3', name: 'Itaú Personalité', color: '#EC7000', lastDigits: '0911' },
];

const CATEGORIES = [
  { id: '1', label: 'Alimentação', color: '#FF9500' },
  { id: '2', label: 'Transporte', color: '#007AFF' },
  { id: '3', label: 'Lazer', color: '#FF2D55' },
  { id: '4', label: 'Saúde', color: '#34C759' },
  { id: '5', label: 'Educação', color: '#5856D6' },
  { id: '6', label: 'Outros', color: '#8E8E93' },
];

const INSTALLMENTS = ['À vista', '2x', '3x', '4x', '5x', '6x', '7x', '8x', '9x', '10x', '11x', '12x'];

export function AddCardBillsModal({ visible, onClose, onSave }: Props) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(''); 
  const [selectedCard, setSelectedCard] = useState(AVAILABLE_CARDS[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [installment, setInstallment] = useState('À vista');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Função para limpar os campos
  const resetForm = useCallback(() => {
    setDescription('');
    setAmount('');
    setInstallment('À vista');
    setSelectedCard(AVAILABLE_CARDS[0]);
    setCategory(CATEGORIES[0]);
    setDate(new Date());
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose?.();
  }, [onClose, resetForm]);

  const formatCurrency = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const numberValue = Number(cleanValue) / 100;
    return numberValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleSave = () => {
    const numericAmount = Number(amount.replace(/\./g, '').replace(',', '.'));
    onSave?.({
      description,
      card: selectedCard.name,
      category: category.label,
      amount: numericAmount,
      installments: installment,
      date: date.toLocaleDateString('pt-BR')
    });
    handleClose();
  };

  const renderInstallmentSchedule = () => {
    const numInstallments = installment === 'À vista' ? 1 : parseInt(installment);
    if (numInstallments <= 1 || !amount) return null;

    const numericAmount = Number(amount.replace(/\./g, '').replace(',', '.'));
    const installmentValue = (numericAmount / numInstallments).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    
    const schedule = [];
    for (let i = 1; i <= numInstallments; i++) {
      const dueDate = new Date(date);
      dueDate.setMonth(date.getMonth() + (i - 1));
      const monthLabel = dueDate.toLocaleString('pt-BR', { month: 'short' }).replace('.', '') + '/' + dueDate.getFullYear().toString().slice(-2);
      
      schedule.push(
        <View key={i} style={styles.scheduleCard}>
          <Text style={styles.scheduleNumber}>{i}/{numInstallments}</Text>
          <Text style={styles.scheduleValue}>R$ {installmentValue}</Text>
          <Text style={styles.scheduleMonth}>{monthLabel}</Text>
        </View>
      );
    }

    return (
      <View style={styles.installmentContainer}>
        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Valor total</Text><Text style={styles.summaryValueBold}>R$ {amount}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Por parcela</Text><Text style={styles.summaryValueBlue}>{numInstallments}x de R$ {installmentValue}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>1º vencimento</Text><Text style={styles.summaryValueBlue}>{date.toLocaleDateString('pt-BR')}</Text></View>
        </View>
        <Text style={styles.scheduleTitle}>Cronograma de parcelas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scheduleScroll}>{schedule}</ScrollView>
      </View>
    );
  };

  return (
    <Modal 
      visible={visible} 
      transparent 
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        {/* Backdrop: TouchableWithoutFeedback garante que o clique fora feche sem efeito visual de clique */}
        <TouchableWithoutFeedback onPress={handleClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheetContainer}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Lançar Despesa</Text>
                <Text style={styles.subtitle}>Registre um gasto no seu cartão</Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              contentContainerStyle={styles.content} 
              showsVerticalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.sectionLabel}>Escolha o Cartão</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {AVAILABLE_CARDS.map((card) => (
                  <TouchableOpacity 
                    key={card.id}
                    onPress={() => setSelectedCard(card)}
                    style={[styles.cardChip, selectedCard.id === card.id && { borderColor: card.color, backgroundColor: card.color + '10' }]}
                  >
                    <View style={[styles.cardDot, { backgroundColor: card.color }]} />
                    <View>
                      <Text style={[styles.cardChipName, selectedCard.id === card.id && { color: card.color }]}>{card.name}</Text>
                      <Text style={styles.cardChipDigits}>•••• {card.lastDigits}</Text>
                    </View>
                    {selectedCard.id === card.id && <Check size={14} color={card.color} style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={[styles.inputCard, { marginTop: spacing.md }]}>
                <View style={styles.inputRow}>
                  <View style={styles.labelGroup}><AlignLeft size={18} color={colors.textSecondary} /><Text style={styles.inputLabel}>Descrição</Text></View>
                  <TextInput 
                    placeholder="Ex: Aluguel..." 
                    value={description} 
                    onChangeText={setDescription} 
                    style={styles.textInput} 
                    textAlign="right" 
                    placeholderTextColor={colors.border} 
                  />
                </View>
                <View style={styles.divider} />
                <View style={styles.inputRow}>
                  <View style={styles.labelGroup}><Text style={[styles.inputLabel, { fontWeight: '600', color: colors.textPrimary }]}>R$ Valor</Text></View>
                  <TextInput 
                    placeholder="0,00" 
                    keyboardType="numeric" 
                    value={amount} 
                    onChangeText={(t) => setAmount(formatCurrency(t))} 
                    style={styles.amountInput} 
                    textAlign="right" 
                  />
                </View>
              </View>

              <Text style={styles.sectionLabel}>Categoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {CATEGORIES.map((item) => (
                  <TouchableOpacity key={item.id} onPress={() => setCategory(item)} style={[styles.chip, category.id === item.id && { borderColor: item.color, backgroundColor: item.color + '10' }]}>
                    <View style={[styles.categoryDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.chipText, category.id === item.id && { color: item.color, fontWeight: '700' }]}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionLabel}>Parcelamento</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {INSTALLMENTS.map((opt) => (
                  <TouchableOpacity key={opt} onPress={() => setInstallment(opt)} style={[styles.installmentChip, installment === opt && styles.installmentChipActive]}>
                    <Text style={[styles.installmentText, installment === opt && styles.installmentTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {renderInstallmentSchedule()}

              <TouchableOpacity style={[styles.inputCard, { marginTop: spacing.lg }]} onPress={() => setShowDatePicker(true)}>
                <View style={styles.inputRow}>
                  <View style={styles.labelGroup}><Calendar size={18} color={colors.textSecondary} /><Text style={styles.inputLabel}>Data da Compra</Text></View>
                  <View style={styles.dateValueBox}>
                    <Text style={styles.dateValueText}>{date.toLocaleDateString('pt-BR')}</Text>
                    <ChevronRight size={16} color={colors.border} />
                  </View>
                </View>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker 
                  value={date} 
                  mode="date" 
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
                  onChange={(e, d) => { 
                    setShowDatePicker(false); 
                    if (d) setDate(d); 
                  }} 
                />
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.saveButton, (!description || !amount) ? styles.buttonDisabled : { backgroundColor: colors.primary }]} 
                  disabled={!description || !amount} 
                  onPress={handleSave}
                >
                  <Text style={styles.saveButtonText}>Confirmar Lançamento</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetContainer: { justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    maxHeight: SCREEN_HEIGHT * 0.9,
    width: '100%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: colors.border,
    borderRadius: radius.pill, alignSelf: 'center', marginVertical: spacing.md,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, marginBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  closeButton: { padding: spacing.xs, backgroundColor: colors.mutedSurface, borderRadius: radius.pill },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: 4, fontWeight: '600' },
  horizontalScroll: { marginHorizontal: -spacing.xl, paddingHorizontal: spacing.xl },
  cardChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  cardDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  cardChipName: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  cardChipDigits: { fontSize: 11, color: colors.textSecondary },
  inputCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, minHeight: 56 },
  labelGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputLabel: { fontSize: 13, color: colors.textSecondary },
  textInput: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '600', marginLeft: 10 },
  amountInput: { flex: 1, fontSize: 15, color: colors.textPrimary, fontWeight: '600', marginLeft: 10 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  installmentChip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginRight: spacing.xs },
  installmentChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  installmentText: { fontSize: 13, color: colors.textSecondary },
  installmentTextActive: { color: colors.primary, fontWeight: '700' },
  installmentContainer: { marginTop: spacing.md, backgroundColor: '#F8FAFC', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryBox: { marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 12, color: colors.textSecondary },
  summaryValueBold: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  summaryValueBlue: { fontSize: 13, fontWeight: '600', color: '#2563EB' },
  scheduleTitle: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm },
  scheduleScroll: { marginHorizontal: -spacing.md, paddingHorizontal: spacing.md },
  scheduleCard: { backgroundColor: '#EFF6FF', padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: '#DBEAFE', marginRight: 8, minWidth: 100, alignItems: 'center' },
  scheduleNumber: { fontSize: 11, color: '#1E40AF', fontWeight: '600' },
  scheduleValue: { fontSize: 13, color: '#1E40AF', fontWeight: '700', marginVertical: 2 },
  scheduleMonth: { fontSize: 11, color: '#60A5FA', fontWeight: '500' },
  dateValueBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateValueText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  cancelButton: { flex: 1, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  cancelButtonText: { fontWeight: '600', color: colors.textSecondary },
  saveButton: { flex: 2, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.5, backgroundColor: '#94a3b8' },
  saveButtonText: { fontWeight: '700', color: colors.white, fontSize: 15 },
});