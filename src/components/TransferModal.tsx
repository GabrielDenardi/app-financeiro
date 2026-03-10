import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Modal, View, Text, StyleSheet, TextInput, ScrollView, 
  TouchableOpacity, Dimensions, KeyboardAvoidingView, 
  Platform, Animated, PanResponder 
} from 'react-native';
import { RefreshCw, X, ArrowLeftRight, ArrowRight } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { accountsMock } from '../data/accountsMock';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function TransferModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [fromAccount, setFromAccount] = useState(accountsMock[0]?.id || '');
  const [toAccount, setToAccount] = useState(accountsMock[1]?.id || '');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pan = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

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
      setAmount('');
      onClose();
      pan.setValue(SCREEN_HEIGHT);
    });
  }, [onClose]);

  const handleTransfer = () => {
    console.log({
      from: accountsMock.find(a => a.id === fromAccount)?.name,
      to: accountsMock.find(a => a.id === toAccount)?.name,
      value: amount
    });
    handleClose();
  };

  const swapAccounts = () => {
    const temp = fromAccount;
    setFromAccount(toAccount);
    setToAccount(temp);
  };

  const selectedFrom = accountsMock.find(a => a.id === fromAccount);
  const selectedTo = accountsMock.find(a => a.id === toAccount);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        </Animated.View>
        
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: pan }] }]}>
            
            <View {...panResponder.panHandlers} style={styles.gestureCapture}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>Transferência</Text>
                  <Text style={styles.subtitle}>Mover saldo entre suas contas</Text>
                </View>
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <X size={18} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView 
              contentContainerStyle={styles.content} 
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.transferFlowCard}>
                <View style={styles.flowItem}>
                  <Text style={styles.flowLabel}>De (Origem)</Text>
                  <Text style={styles.flowAccountName} numberOfLines={1}>
                    {selectedFrom?.name || 'Selecionar'}
                  </Text>
                </View>
                
                <TouchableOpacity onPress={swapAccounts} style={styles.swapButton} activeOpacity={0.7}>
                  <ArrowLeftRight size={18} color={colors.primary} />
                </TouchableOpacity>

                <View style={[styles.flowItem, { alignItems: 'flex-end' }]}>
                  <Text style={styles.flowLabel}>Para (Destino)</Text>
                  <Text style={[styles.flowAccountName, { textAlign: 'right' }]} numberOfLines={1}>
                    {selectedTo?.name || 'Selecionar'}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionLabel}>Conta de Saída</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {accountsMock.map((acc) => (
                  <TouchableOpacity 
                    key={`from-${acc.id}`}
                    onPress={() => setFromAccount(acc.id)}
                    style={[styles.accountChip, fromAccount === acc.id && styles.accountChipActive]}
                  >
                    <Text style={[styles.accountChipText, fromAccount === acc.id && styles.accountChipTextActive]}>
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionLabel}>Conta de Entrada</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {accountsMock.map((acc) => (
                  <TouchableOpacity 
                    key={`to-${acc.id}`}
                    onPress={() => setToAccount(acc.id)}
                    disabled={acc.id === fromAccount}
                    style={[
                      styles.accountChip, 
                      toAccount === acc.id && styles.accountChipActive,
                      acc.id === fromAccount && styles.accountDisabled
                    ]}
                  >
                    <Text style={[styles.accountChipText, toAccount === acc.id && styles.accountChipTextActive]}>
                      {acc.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Quanto deseja transferir?</Text>
                <View style={styles.amountContainer}>
                  <Text style={styles.currencyPrefix}>R$</Text>
                  <TextInput 
                    placeholder="0,00" 
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                    style={styles.amountInput}
                    placeholderTextColor={colors.textSecondary}
                    maxLength={10}
                  />
                </View>
              </View>

              <View style={{ height: 140 }} />
            </ScrollView>

            <View style={styles.fixedFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.saveButton, (!amount || fromAccount === toAccount) && { opacity: 0.5 }]} 
                onPress={handleTransfer}
                disabled={!amount || fromAccount === toAccount}
              >
                <RefreshCw size={18} color={colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Confirmar</Text>
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
  },
  gestureCapture: {
    paddingTop: 12, backgroundColor: colors.background,
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
  
  transferFlowCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, padding: 20,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    marginBottom: 24,
  },
  flowItem: { flex: 1 },
  flowLabel: { fontSize: 10, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 },
  flowAccountName: { fontSize: 15, color: colors.textPrimary, fontWeight: '700' },
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
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },

  sectionLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, fontWeight: '700', textTransform: 'uppercase' },
  horizontalScroll: { marginHorizontal: -24, paddingHorizontal: 24, marginBottom: 24 },
  accountChip: {
    paddingHorizontal: 16, height: 40, justifyContent: 'center',
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, marginRight: 8,
  },
  accountChipActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  accountDisabled: { opacity: 0.3, backgroundColor: colors.mutedSurface },
  accountChipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  accountChipTextActive: { color: colors.primary, fontWeight: '700' },

inputCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center', 
  },
  inputLabel: { 
    fontSize: 14, 
    color: colors.textSecondary, 
    marginBottom: 12,
    fontWeight: '500'
  },
  amountContainer: { 
    flexDirection: 'row', 
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
  },
  currencyPrefix: { 
    fontSize: 24, 
    color: colors.textPrimary, 
    fontWeight: '700',
    marginRight: 4,
    marginTop: 4,
  },
  amountInput: { 
    fontSize: 30, 
    color: colors.textPrimary, 
    fontWeight: '700',
    padding: 0,
    minWidth: 150,
    textAlign: 'center', 
    overflow: 'hidden',
  },

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  saveButtonText: { fontSize: 15, color: colors.white, fontWeight: '700' },
});