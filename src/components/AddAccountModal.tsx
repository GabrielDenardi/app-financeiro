import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Modal, View, Text, StyleSheet, TextInput, ScrollView, 
  TouchableOpacity, Dimensions, KeyboardAvoidingView, 
  Platform, Animated, PanResponder 
} from 'react-native';
import { X, Wallet, TrendingUp, PiggyBank, Banknote, Building2, Check } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ACCOUNT_TYPES = [
  { id: 'corrente', label: 'Corrente', icon: Wallet },
  { id: 'poupanca', label: 'Poupança', icon: PiggyBank },
  { id: 'investimento', label: 'Investimento', icon: TrendingUp },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { id: 'outros', label: 'Outros', icon: Building2 },
];

const POPULAR_BANKS = [
  { id: '1', name: 'Nubank', color: '#8A05BE' },
  { id: '2', name: 'Inter', color: '#FF7A00' },
  { id: '3', name: 'Itaú', color: '#EC7000' },
  { id: '4', name: 'Bradesco', color: '#CC092F' },
  { id: '5', name: 'Santander', color: '#EC0000' },
  { id: '6', name: 'C6 Bank', color: '#212121' },
];

export function AddAccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [balance, setBalance] = useState('');
  const [selectedType, setSelectedType] = useState('corrente');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Lógica de Gesto e Trava Superior
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) pan.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120) handleClose();
        else {
          Animated.timing(pan, { toValue: 0, duration: 200, useNativeDriver: true }).start();
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

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(pan, { toValue: SCREEN_HEIGHT, duration: 300, useNativeDriver: true })
    ]).start(() => {
      setName('');
      setInstitution('');
      setBalance('');
      setSelectedType('corrente');
      onClose();
      pan.setValue(SCREEN_HEIGHT);
    });
  }, [onClose]);

  const handleSave = () => {
    console.log({ name, institution, balance, selectedType });
    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        </Animated.View>
        
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end' }}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: pan }] }]}>
            
            {/* Header Fixo com Gesto */}
            <View {...panResponder.panHandlers} style={styles.gestureCapture}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>Nova Conta</Text>
                  <Text style={styles.subtitle}>Configure os detalhes da conta</Text>
                </View>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
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
              <Text style={styles.sectionLabel}>Tipo de Conta</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {ACCOUNT_TYPES.map((type) => (
                  <TouchableOpacity 
                    key={type.id}
                    onPress={() => setSelectedType(type.id)}
                    style={[styles.typeItem, selectedType === type.id && styles.typeItemActive]}
                  >
                    <type.icon size={18} color={selectedType === type.id ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.typeLabel, selectedType === type.id && styles.typeLabelActive]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionLabel}>Instituições Populares</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {POPULAR_BANKS.map((bank) => (
                  <TouchableOpacity 
                    key={bank.id}
                    onPress={() => {
                      setInstitution(bank.name);
                      setName(bank.name); 
                    }}
                    style={[styles.bankChip, institution === bank.name && { borderColor: bank.color, backgroundColor: bank.color + '10' }]}
                  >
                    <View style={[styles.bankDot, { backgroundColor: bank.color }]} />
                    <Text style={styles.bankChipText}>{bank.name}</Text>
                    {institution === bank.name && <Check size={14} color={bank.color} style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.inputCard}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Apelido</Text>
                  <TextInput 
                    placeholder="Ex: Minha Carteira" 
                    value={name}
                    onChangeText={setName}
                    style={styles.textInput} 
                    textAlign="right"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.divider} />

                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Saldo Inicial</Text>
                  <View style={styles.amountInputRow}>
                    <Text style={styles.currencyPrefix}>R$</Text>
                    <TextInput 
                      placeholder="0,00" 
                      keyboardType="decimal-pad"
                      value={balance}
                      onChangeText={setBalance}
                      style={styles.amountInput}
                    />
                  </View>
                </View>
              </View>

              {/* Espaço para não ficar atrás do footer */}
              <View style={{ height: 120 }} /> 
            </ScrollView>

            {/* Footer Fixo */}
            <View style={styles.fixedFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.saveButton, (!name || !balance) && { opacity: 0.6 }]} 
                onPress={handleSave}
                disabled={!name || !balance}
              >
                <Text style={styles.saveButtonText}>Criar Conta</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
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
    maxHeight: SCREEN_HEIGHT * 0.85,
    minHeight: 100,
  },
  gestureCapture: {
    paddingTop: 12, 
    backgroundColor: colors.background,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    zIndex: 10,
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
  content: { paddingHorizontal: 24 },
  sectionLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.5 },
  horizontalScroll: { marginHorizontal: -24, paddingHorizontal: 24, marginBottom: 24 },
  
  typeItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, height: 44,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, marginRight: 8,
  },
  typeItemActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  typeLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  typeLabelActive: { color: colors.primary, fontWeight: '700' },

  bankChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, height: 44,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, marginRight: 8,
  },
  bankDot: { width: 8, height: 8, borderRadius: 4 },
  bankChipText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },

  inputCard: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, height: 56,
  },
  inputLabel: { fontSize: 15, color: colors.textSecondary },
  textInput: { fontSize: 15, color: colors.textPrimary, fontWeight: '600', flex: 1, marginLeft: 16 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
  amountInputRow: { flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { fontSize: 15, color: colors.textPrimary, marginRight: 4, fontWeight: '700' },
  amountInput: { fontSize: 15, color: colors.textPrimary, fontWeight: '700', minWidth: 60, textAlign: 'right' },

  fixedFooter: { 
    position: 'absolute', bottom: 0, left: 0, right: 0, 
    flexDirection: 'row', gap: 12, paddingHorizontal: 24, 
    paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.border,
  },
  cancelButton: {
    flex: 1, height: 54, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  cancelButtonText: { fontSize: 15, color: colors.textPrimary, fontWeight: '600' },
  saveButton: {
    flex: 1, height: 54, backgroundColor: colors.primaryLight, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  saveButtonText: { fontSize: 15, color: colors.white, fontWeight: '700' },
});