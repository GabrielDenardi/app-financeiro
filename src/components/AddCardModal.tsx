import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Modal, View, Text, StyleSheet, TextInput, ScrollView, 
  TouchableOpacity, Dimensions, KeyboardAvoidingView, 
  Platform, Animated, PanResponder 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, CreditCard, Check } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const POPULAR_BANKS = [
  { id: '1', name: 'Nubank', color: '#8A05BE' },
  { id: '2', name: 'Inter', color: '#FF7A00' },
  { id: '3', name: 'Itaú', color: '#EC7000' },
  { id: '4', name: 'Bradesco', color: '#CC092F' },
  { id: '5', name: 'Santander', color: '#EC0000' },
  { id: '6', name: 'C6 Bank', color: '#212121' },
];

const NETWORKS = ['Visa', 'Mastercard', 'Elo'];
const CARD_COLORS = ['#8A05BE', '#FF7A00', '#1E3A8A', '#DC2626', '#16A34A', '#0F172A'];

export function AddCardModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [network, setNetwork] = useState('Visa');
  const [limit, setLimit] = useState('');
  const [lastDigits, setLastDigits] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [cardColor, setCardColor] = useState(CARD_COLORS[0]);

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
      setName('');
      setInstitution('');
      setLimit('');
      setLastDigits('');
      setClosingDay('');
      setDueDay('');
      onClose();
      pan.setValue(SCREEN_HEIGHT);
    });
  }, [onClose]);

  const getGradientColors = (baseColor: string): [string, string] => {
    if (baseColor === '#0F172A') return ['#334155', '#0F172A'];
    return [baseColor, baseColor + 'DD']; 
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        </Animated.View>
        
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ justifyContent: 'flex-end' }}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY: pan }] }]}>
            
            <View {...panResponder.panHandlers} style={styles.gestureCapture}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>Novo Cartão</Text>
                  <Text style={styles.subtitle}>Configure os detalhes do seu cartão</Text>
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
              <View style={styles.previewContainer}>
                <LinearGradient
                  colors={getGradientColors(cardColor)} 
                  style={styles.cardPreview}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.circleDecorationTop} />
                  <View style={styles.circleDecorationBottom} />

                  <View style={styles.cardHeaderPreview}>
                    <View>
                      <Text style={styles.cardPreviewInstLabel}>{institution.toUpperCase() || 'INSTITUIÇÃO'}</Text>
                      <Text style={styles.cardPreviewNameText}>{name || 'Nome do Cartão'}</Text>
                    </View>
                    <Text style={styles.cardPreviewNetworkText}>{network}</Text>
                  </View>

                  <Text style={styles.cardPreviewDigitsText}>••••  ••••  ••••  {lastDigits || '****'}</Text>

                  <View style={styles.cardPreviewFooter}>
                    <View>
                      <Text style={styles.cardFooterLabel}>VENCIMENTO</Text>
                      <Text style={styles.cardFooterValue}>DIA {dueDay || '--'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.cardFooterLabel}>LIMITE TOTAL</Text>
                      <Text style={styles.cardFooterValue}>R$ {limit || '0,00'}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>

              <Text style={styles.sectionLabel}>Cor do Cartão</Text>
              <View style={styles.colorRow}>
                 {CARD_COLORS.map(color => (
                   <TouchableOpacity 
                     key={color} 
                     style={[styles.colorOption, { backgroundColor: color }]} 
                     onPress={() => setCardColor(color)}
                   >
                     {cardColor === color && <Check size={16} color="#FFF" />}
                   </TouchableOpacity>
                 ))}
              </View>

              <Text style={styles.sectionLabel}>Instituição</Text>
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
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionLabel}>Bandeira</Text>
              <View style={styles.networkRow}>
                {NETWORKS.map((net) => (
                  <TouchableOpacity 
                    key={net}
                    onPress={() => setNetwork(net)}
                    style={[styles.typeItem, network === net && styles.typeItemActive]}
                  >
                    <CreditCard size={16} color={network === net ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.typeLabel, network === net && styles.typeLabelActive]}>{net}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputCard}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Nome do Cartão</Text>
                  <TextInput 
                    placeholder="Ex: Nubank Black" 
                    value={name}
                    onChangeText={setName}
                    style={styles.textInput} 
                    textAlign="right"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.divider} />
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Últimos 4 dígitos</Text>
                  <TextInput 
                    placeholder="0000" 
                    keyboardType="numeric"
                    maxLength={4}
                    value={lastDigits}
                    onChangeText={setLastDigits}
                    style={styles.textInput} 
                    textAlign="right"
                  />
                </View>
                <View style={styles.divider} />
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Limite Total</Text>
                  <TextInput 
                    placeholder="0,00" 
                    keyboardType="numeric"
                    value={limit}
                    onChangeText={setLimit}
                    style={styles.textInput}
                    textAlign="right"
                  />
                </View>
              </View>

              <View style={[styles.inputCard, { marginTop: 16 }]}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Dia do Vencimento</Text>
                  <TextInput 
                    placeholder="10" 
                    keyboardType="numeric"
                    maxLength={2}
                    value={dueDay}
                    onChangeText={setDueDay}
                    style={styles.textInput} 
                    textAlign="right"
                  />
                </View>
                <View style={styles.divider} />
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Dia do Fechamento</Text>
                  <TextInput 
                    placeholder="03" 
                    keyboardType="numeric"
                    maxLength={2}
                    value={closingDay}
                    onChangeText={setClosingDay}
                    style={styles.textInput} 
                    textAlign="right"
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
                style={[styles.saveButton, (!name || !dueDay) && { opacity: 0.5 }]} 
                disabled={!name || !dueDay}
                onPress={handleClose}
              >
                <Text style={styles.saveButtonText}>Criar Cartão</Text>
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
    maxHeight: SCREEN_HEIGHT * 0.9,
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
  previewContainer: { alignItems: 'center', marginBottom: 24 },
  cardPreview: {
    width: '100%', height: 180, borderRadius: 24, padding: 24,
    justifyContent: 'space-between', overflow: 'hidden',
    elevation: 12, shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12,
  },
  circleDecorationTop: {
    position: 'absolute', right: -20, top: -40, width: 140, height: 140,
    borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)'
  },
  circleDecorationBottom: {
    position: 'absolute', left: -20, bottom: -60, width: 120, height: 120,
    borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)'
  },
  cardHeaderPreview: { flexDirection: 'row', justifyContent: 'space-between' },
  cardPreviewInstLabel: { color: colors.white, opacity: 0.8, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  cardPreviewNameText: { color: colors.white, fontSize: 18, fontWeight: '700', marginTop: 4 },
  cardPreviewNetworkText: { color: colors.white, fontSize: 16, fontWeight: '800', fontStyle: 'italic' },
  cardPreviewDigitsText: { color: colors.white, fontSize: 18, letterSpacing: 3, opacity: 0.9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  cardPreviewFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardFooterLabel: { color: colors.white, fontSize: 9, opacity: 0.7, fontWeight: '700', marginBottom: 2 },
  cardFooterValue: { color: colors.white, fontSize: 14, fontWeight: '700' },

  sectionLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.5 },
  colorRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  colorOption: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF', elevation: 2 },
  
  horizontalScroll: { marginHorizontal: -24, paddingHorizontal: 24, marginBottom: 24 },
  bankChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, height: 44,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, marginRight: 8,
  },
  bankDot: { width: 8, height: 8, borderRadius: 4 },
  bankChipText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },

  networkRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  typeItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 44, backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  typeItemActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  typeLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
  typeLabelActive: { color: colors.primary, fontWeight: '700' },

  inputCard: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, height: 56,
  },
  inputLabel: { fontSize: 14, color: colors.textSecondary },
  textInput: { flex: 1, fontSize: 14, color: colors.textPrimary, fontWeight: '600', marginLeft: 16 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },

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