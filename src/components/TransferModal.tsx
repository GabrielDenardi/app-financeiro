import React, { useState, useEffect, useRef } from 'react';
import { 
  Modal, View, Text, StyleSheet, Pressable, 
  TextInput, Animated, ScrollView, TouchableOpacity 
} from 'react-native';
import { RefreshCw, ArrowRight, X, ArrowLeftRight } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { accountsMock } from '../data/accountsMock';

export function TransferModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [fromAccount, setFromAccount] = useState(accountsMock[0]?.id || '');
  const [toAccount, setToAccount] = useState(accountsMock[1]?.id || '');

  // Animação de subida
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

  const handleTransfer = () => {
    console.log({
      from: accountsMock.find(a => a.id === fromAccount)?.name,
      to: accountsMock.find(a => a.id === toAccount)?.name,
      value: amount
    });
    handleClose();
  };

  const handleClose = () => {
    setAmount('');
    onClose();
  };

  const swapAccounts = () => {
    const temp = fromAccount;
    setFromAccount(toAccount);
    setToAccount(temp);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Transferência</Text>
              <Text style={styles.subtitle}>Mover saldo entre suas contas</Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            
            {/* Fluxo de Transferência */}
            <View style={styles.transferFlowCard}>
              <View style={styles.flowItem}>
                <Text style={styles.flowLabel}>Origem</Text>
                <Text style={styles.flowAccountName} numberOfLines={1}>
                  {accountsMock.find(a => a.id === fromAccount)?.name || 'Selecionar'}
                </Text>
              </View>
              
              <TouchableOpacity onPress={swapAccounts} style={styles.swapButton}>
                <ArrowLeftRight size={16} color={colors.primary} />
              </TouchableOpacity>

              <View style={[styles.flowItem, { alignItems: 'flex-end' }]}>
                <Text style={styles.flowLabel}>Destino</Text>
                <Text style={styles.flowAccountName} numberOfLines={1}>
                  {accountsMock.find(a => a.id === toAccount)?.name || 'Selecionar'}
                </Text>
              </View>
            </View>

            {/* Seleção de Conta de Origem */}
            <Text style={styles.sectionLabel}>De onde sai o dinheiro?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountScroll}>
              {accountsMock.map((acc) => (
                <Pressable 
                  key={`from-${acc.id}`}
                  onPress={() => setFromAccount(acc.id)}
                  style={[styles.accountChip, fromAccount === acc.id && styles.accountChipActive]}
                >
                  <Text style={[styles.accountChipText, fromAccount === acc.id && styles.accountChipTextActive]}>
                    {acc.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Seleção de Conta de Destino */}
            <Text style={styles.sectionLabel}>Para onde vai o dinheiro?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountScroll}>
              {accountsMock.map((acc) => (
                <Pressable 
                  key={`to-${acc.id}`}
                  onPress={() => setToAccount(acc.id)}
                  disabled={acc.id === fromAccount}
                  style={[
                    styles.accountChip, 
                    toAccount === acc.id && styles.accountChipActive,
                    acc.id === fromAccount && { opacity: 0.3 }
                  ]}
                >
                  <Text style={[styles.accountChipText, toAccount === acc.id && styles.accountChipTextActive]}>
                    {acc.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Input de Valor */}
            <View style={styles.inputCard}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Valor</Text>
                <View style={styles.amountInputRow}>
                  <Text style={styles.currencyPrefix}>R$</Text>
                  <TextInput 
                    placeholder="0,00" 
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                    style={styles.amountInput}
                    autoFocus
                  />
                </View>
              </View>
            </View>

            {/* Ações */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleClose}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.primaryButton, (!amount || fromAccount === toAccount) && { opacity: 0.6 }]} 
                onPress={handleTransfer}
                disabled={!amount || fromAccount === toAccount}
              >
                <RefreshCw size={18} color={colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.primaryButtonText}>Transferir</Text>
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
    maxHeight: '85%',
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
  
  // Card de Fluxo (Visual de De -> Para)
  transferFlowCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, padding: spacing.lg,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  flowItem: { flex: 1 },
  flowLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: 2 },
  flowAccountName: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  swapButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: spacing.md,
  },

  sectionLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, fontWeight: '600' },
  accountScroll: { marginBottom: spacing.lg },
  accountChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
  },
  accountChipActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  accountChipText: { ...typography.caption, color: colors.textSecondary },
  accountChipTextActive: { color: colors.primary, fontWeight: '700' },

  inputCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    marginTop: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, minHeight: 56,
  },
  inputLabel: { ...typography.body, color: colors.textSecondary },
  amountInputRow: { flexDirection: 'row', alignItems: 'center' },
  currencyPrefix: { ...typography.body, color: colors.textPrimary, marginRight: 4, fontWeight: '700' },
  amountInput: { ...typography.body, color: colors.textPrimary, fontWeight: '700', minWidth: 80 },

  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  secondaryButton: {
    flex: 1, height: 56, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  secondaryButtonText: { ...typography.body, color: colors.textSecondary, fontWeight: '600' },
  primaryButton: {
    flex: 2, height: 56, backgroundColor: colors.primary, borderRadius: radius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  primaryButtonText: { ...typography.body, color: colors.white, fontWeight: '700' },
});