import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Modal, View, Text, StyleSheet, TextInput, ScrollView, 
  TouchableOpacity, Dimensions, KeyboardAvoidingView, 
  Platform, Animated, PanResponder 
} from 'react-native';
import { X, ChevronRight, Check } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../theme'; 
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
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // PanResponder com trava superior (não sobe além do 0)
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          pan.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120) {
          closeModal();
        } else {
          Animated.timing(pan, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(pan, { toValue: 0, duration: 350, useNativeDriver: true })
      ]).start();
    }
  }, [visible]);

  const closeModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(pan, { toValue: SCREEN_HEIGHT, duration: 300, useNativeDriver: true })
    ]).start(() => {
      resetForm();
      onClose?.();
    });
  }, [onClose]);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setInstallment('À vista');
    setSelectedCard(AVAILABLE_CARDS[0]);
    setCategory(CATEGORIES[0]);
    setDate(new Date());
    pan.setValue(SCREEN_HEIGHT);
  };

  const formatCurrency = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    const numberValue = Number(cleanValue) / 100;
    return numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSave = () => {
    const numericAmount = Number(amount.replace(/\./g, '').replace(',', '.'));
    onSave?.({ description, card: selectedCard.name, category: category.label, amount: numericAmount, installments: installment, date: date.toLocaleDateString('pt-BR') });
    closeModal();
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
        </View>
        <Text style={styles.scheduleTitle}>Cronograma</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scheduleScroll}>{schedule}</ScrollView>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeModal}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />
        </Animated.View>
        
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end' }}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: pan }] }]}>

            <View {...panResponder.panHandlers} style={styles.gestureCapture}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>Lançar Despesa</Text>
                  <Text style={styles.subtitle}>Registre um gasto no seu cartão</Text>
                </View>
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                  <X size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              contentContainerStyle={styles.content} 
              showsVerticalScrollIndicator={false} 
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <Text style={styles.inputLabel}>Escolha o Cartão</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {AVAILABLE_CARDS.map((card) => (
                  <TouchableOpacity 
                    key={card.id} 
                    onPress={() => setSelectedCard(card)} 
                    style={[styles.cardChip, selectedCard.id === card.id && { borderColor: card.color, backgroundColor: card.color + '10' }]}
                  >
                    <View style={[styles.cardDot, { backgroundColor: card.color }]} />
                    <Text style={[styles.cardChipName, selectedCard.id === card.id && { color: card.color }]}>{card.name}</Text>
                    {selectedCard.id === card.id && <Check size={14} color={card.color} style={{ marginLeft: 8 }} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.mainCard}>
                <View style={styles.infoRow}><Text style={styles.infoLabel}>Valor</Text><TextInput placeholder="R$ 0,00" keyboardType="numeric" value={amount} onChangeText={(t) => setAmount(formatCurrency(t))} style={styles.amountInput} /></View>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.infoRow} onPress={() => setShowDatePicker(true)}><Text style={styles.infoLabel}>Data</Text><View style={styles.valueWithIcon}><Text style={styles.infoValue}>{date.toLocaleDateString('pt-BR')}</Text><ChevronRight size={18} color={colors.textSecondary} /></View></TouchableOpacity>
              </View>

              <View style={styles.mutedCard}>
                <Text style={styles.mutedCardHeader}>Detalhes da Fatura</Text>
                <Text style={styles.sectionLabelMini}>Categoria</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniChipScroll}>
                   {CATEGORIES.map((item) => (
                     <TouchableOpacity key={item.id} onPress={() => setCategory(item)} style={[styles.miniChip, category.id === item.id && { backgroundColor: item.color + '20', borderColor: item.color }]}>
                       <Text style={[styles.miniChipText, category.id === item.id && { color: item.color, fontWeight: '700' }]}>{item.label}</Text>
                     </TouchableOpacity>
                   ))}
                </ScrollView>
                <Text style={[styles.sectionLabelMini, { marginTop: 16 }]}>Parcelas</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.miniChipScroll}>
                  {INSTALLMENTS.map((opt) => (
                    <TouchableOpacity key={opt} onPress={() => setInstallment(opt)} style={[styles.miniChip, installment === opt && { borderColor: colors.primaryLight, backgroundColor: '#EFF6FF' }]}>
                      <Text style={[styles.miniChipText, installment === opt && { color: colors.primaryLight, fontWeight: '700' }]}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {renderInstallmentSchedule()}

              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionHeader}>Descrição</Text>
                <TextInput placeholder="Adicione uma descrição..." multiline value={description} onChangeText={setDescription} style={styles.descriptionInput} placeholderTextColor={colors.textSecondary} />
              </View>

              <View style={{ height: 140 }} /> 
            </ScrollView>

            <View style={styles.fixedFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.continueBtn, (!amount || !description) && { opacity: 0.6 }]} onPress={handleSave} disabled={!amount || !description}>
                <Text style={styles.continueBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>

        {showDatePicker && (<DateTimePicker value={date} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(false); if (d) setDate(d); }} />)}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    maxHeight: SCREEN_HEIGHT * 0.9,
    minHeight: 100,
  },
  gestureCapture: {
    paddingTop: 12, 
    backgroundColor: colors.background,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    zIndex: 5,
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.border,
    borderRadius: 2, alignSelf: 'center', marginBottom: 12,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', 
    alignItems: 'center', paddingHorizontal: 24, marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  closeButton: { 
    width: 34, height: 34, borderRadius: 17, 
    backgroundColor: colors.surface, alignItems: 'center', 
    justifyContent: 'center', borderWidth: 1, borderColor: colors.border 
  },
  content: { paddingHorizontal: 20 },
  inputLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, marginLeft: 4, fontWeight: '600' },
  horizontalScroll: { marginHorizontal: -20, paddingHorizontal: 20, marginBottom: 20 },
  cardChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 44, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  cardDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  cardChipName: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  mainCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  infoLabel: { fontSize: 14, color: colors.textSecondary },
  valueWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '700' },
  amountInput: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, textAlign: 'right', flex: 1 },
  divider: { height: 1, backgroundColor: colors.border },
  mutedCard: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16 },
  mutedCardHeader: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
  sectionLabelMini: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '600', marginBottom: 8, marginLeft: 4 },
  miniChipScroll: { marginHorizontal: -16, paddingHorizontal: 16, marginBottom: 3, },
  miniChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginRight: 6, backgroundColor: colors.surface },
  miniChipText: { fontSize: 12, color: colors.textSecondary },
  descriptionContainer: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginTop: 4 },
  descriptionHeader: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
  descriptionInput: { height: 80, textAlignVertical: 'top', fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  installmentContainer: { marginBottom: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  summaryBox: { marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryLabel: { fontSize: 12, color: colors.textSecondary },
  summaryValueBold: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  summaryValueBlue: { fontSize: 13, fontWeight: '600', color: colors.primaryLight },
  scheduleTitle: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 10 },
  scheduleScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  scheduleCard: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginRight: 8, minWidth: 100, alignItems: 'center' },
  scheduleNumber: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  scheduleValue: { fontSize: 13, color: colors.textPrimary, fontWeight: '700', marginVertical: 2 },
  scheduleMonth: { fontSize: 11, color: colors.primaryLight, fontWeight: '500' },
  fixedFooter: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    flexDirection: 'row', gap: 12, paddingHorizontal: 20, 
    paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.border,
  },
  cancelBtn: { flex: 1, height: 54, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  continueBtn: { flex: 1, height: 54, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  continueBtnText: { fontSize: 15, fontWeight: '600', color: colors.white },
});