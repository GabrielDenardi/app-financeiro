import React, { useState, useEffect, useRef } from 'react';
import { 
  Modal, View, Text, StyleSheet, Pressable, 
  TextInput, Animated, ScrollView, TouchableOpacity 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Landmark, X, Wallet, TrendingUp, PiggyBank, Banknote, Building2 } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';

// Tipos de conta expandidos
const ACCOUNT_TYPES = [
  { id: 'corrente', label: 'Corrente', icon: Wallet },
  { id: 'poupanca', label: 'Poupança', icon: PiggyBank },
  { id: 'investimento', label: 'Investimento', icon: TrendingUp },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote },
  { id: 'outros', label: 'Outros', icon: Building2 },
];

// Bancos padrões para seleção rápida
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

  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11
      }).start();
    } else {
      slideAnim.setValue(600);
    }
  }, [visible]);

  const handleSave = () => {
    console.log({ name, institution, balance, selectedType });
    handleClose();
  };

  const handleClose = () => {
    setName('');
    setInstitution('');
    setBalance('');
    setSelectedType('corrente');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Nova Conta</Text>
              <Text style={styles.subtitle}>Configure os detalhes da conta</Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            
            {/* Seleção de Tipo (Horizontal Scroll) */}
            <Text style={styles.sectionLabel}>Tipo de Conta</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {ACCOUNT_TYPES.map((type) => (
                <Pressable 
                  key={type.id}
                  onPress={() => setSelectedType(type.id)}
                  style={[styles.typeItem, selectedType === type.id && styles.typeItemActive]}
                >
                  <type.icon size={18} color={selectedType === type.id ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.typeLabel, selectedType === type.id && styles.typeLabelActive]}>
                    {type.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Seleção de Bancos Padrão */}
            <Text style={styles.sectionLabel}>Instituições sugeridas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bankScroll}>
              {POPULAR_BANKS.map((bank) => (
                <Pressable 
                  key={bank.id}
                  onPress={() => {
                    setInstitution(bank.name);
                    if(!name) setName(bank.name); // Preenche o apelido se estiver vazio
                  }}
                  style={[styles.bankChip, institution === bank.name && { borderColor: bank.color }]}
                >
                  <View style={[styles.bankDot, { backgroundColor: bank.color }]} />
                  <Text style={styles.bankChipText}>{bank.name}</Text>
                </Pressable>
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
                  placeholderTextColor={colors.border}
                />
              </View>
              <View style={styles.divider} />
              
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Instituição</Text>
                <TextInput 
                  placeholder="Nome do banco" 
                  value={institution}
                  onChangeText={setInstitution}
                  style={styles.textInput} 
                  textAlign="right"
                  placeholderTextColor={colors.border}
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

            {/* Ações: Cancelar e Salvar */}
            <View style={styles.actionRow}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={handleClose}
              >
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
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.xs,
    maxHeight: '90%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: colors.border,
    borderRadius: radius.pill, alignSelf: 'center', marginVertical: spacing.md,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.xl, marginBottom: spacing.lg,
  },
  title: { ...typography.h2, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  closeButton: {
    padding: spacing.xs, backgroundColor: colors.mutedSurface, borderRadius: radius.pill,
  },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  sectionLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, marginLeft: 4, fontWeight: '600' },
  
  typeScroll: { marginBottom: spacing.lg },
  typeItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
  },
  typeItemActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  typeLabel: { ...typography.caption, color: colors.textSecondary },
  typeLabelActive: { color: colors.primary, fontWeight: '700' },

  bankScroll: { marginBottom: spacing.xl },
  bankChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
  },
  bankDot: { width: 8, height: 8, borderRadius: 4 },
  bankChipText: { ...typography.caption, color: colors.textPrimary, fontWeight: '500' },

  inputCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, minHeight: 56,
  },
  inputLabel: { ...typography.body, color: colors.textSecondary },
  textInput: { ...typography.body, color: colors.textPrimary, flex: 1, marginLeft: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  amountInputRow: { flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { ...typography.body, color: colors.textPrimary, marginRight: 4, fontWeight: '700' },
  amountInput: { ...typography.body, color: colors.textPrimary, fontWeight: '700', minWidth: 60 },

  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  cancelButton: {
    flex: 1, height: 56, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  cancelButtonText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  saveButton: {
    flex: 2, height: 56, backgroundColor: colors.success, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  saveButtonText: { ...typography.body, color: colors.white, fontWeight: '700' },
});