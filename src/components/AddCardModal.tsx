import React, { useState, useEffect, useRef } from 'react';
import { 
  Modal, View, Text, StyleSheet, Pressable, 
  TextInput, Animated, ScrollView, TouchableOpacity, Dimensions 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, CreditCard } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';

const { width } = Dimensions.get('window');

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

  const handleClose = () => {
    setName('');
    setInstitution('');
    setLimit('');
    setLastDigits('');
    setClosingDay('');
    setDueDay('');
    onClose();
  };

  const getGradientColors = (baseColor: string): [string, string] => {
    if (baseColor === '#0F172A') return ['#334155', '#0F172A'];
    return [baseColor, baseColor + 'CC']; 
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Novo Cartão</Text>
              <Text style={styles.subtitle}>Configure os detalhes do seu cartão</Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X size={20} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

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
                    <Text style={styles.cardPreviewInstLabel}>{institution || 'BANCO'}</Text>
                    <Text style={styles.cardPreviewNameText}>{name || 'Nome do Cartão'}</Text>
                  </View>
                  <Text style={styles.cardPreviewNetworkText}>{network}</Text>
                </View>

                <Text style={styles.cardPreviewDigitsText}>•••• •••• •••• {lastDigits || '****'}</Text>

                <View style={styles.cardPreviewFooter}>
                  <View>
                    <Text style={styles.cardFooterLabel}>Vencimento</Text>
                    <Text style={styles.cardFooterValue}>Dia {dueDay || '10'}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.cardFooterLabel}>Limite Disp.</Text>
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
                   style={[
                     styles.colorOption, 
                     { backgroundColor: color }, 
                     cardColor === color && { borderColor: colors.primary, borderWidth: 3 }
                   ]} 
                   onPress={() => setCardColor(color)}
                 />
               ))}
            </View>

            <Text style={styles.sectionLabel}>Instituições sugeridas</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {POPULAR_BANKS.map((bank) => (
                <Pressable 
                  key={bank.id}
                  onPress={() => {
                    setInstitution(bank.name);
                    setName(bank.name);
                  }}
                  style={[styles.bankChip, institution === bank.name && { borderColor: colors.primary }]}
                >
                  <Text style={styles.bankChipText}>{bank.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.sectionLabel}>Bandeira</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {NETWORKS.map((net) => (
                <Pressable 
                  key={net}
                  onPress={() => setNetwork(net)}
                  style={[styles.typeItem, network === net && styles.typeItemActive]}
                >
                  <CreditCard size={18} color={network === net ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.typeLabel, network === net && styles.typeLabelActive]}>{net}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.inputCard}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Nome do Cartão</Text>
                <TextInput 
                  placeholder="Ex: Nubank Principal" 
                  value={name}
                  onChangeText={setName}
                  style={styles.textInput} 
                  textAlign="right"
                />
              </View>
              <View style={styles.divider} />

              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Últimos 4 dígitos</Text>
                <TextInput 
                  placeholder="1234" 
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
                <Text style={styles.inputLabel}>Limite (R$)</Text>
                <TextInput 
                  placeholder="5000" 
                  keyboardType="decimal-pad"
                  value={limit}
                  onChangeText={setLimit}
                  style={styles.textInput}
                  textAlign="right"
                />
              </View>
            </View>

            <View style={[styles.inputCard, { marginTop: spacing.lg }]}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Dia de Vencimento *</Text>
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
                <Text style={styles.inputLabel}>Dia de Fechamento</Text>
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

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.saveButton, (!name || !dueDay) && { opacity: 0.6, backgroundColor: '#94a3b8' }]} 
                disabled={!name || !dueDay}
                onPress={() => {
                  handleClose();
                }}
              >
                <Text style={styles.saveButtonText}>Criar Cartão</Text>
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
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '92%',
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

  previewContainer: { alignItems: 'center', marginBottom: spacing.lg },
  cardPreview: {
    width: '100%', height: 175, borderRadius: 20, padding: 22,
    justifyContent: 'space-between', overflow: 'hidden',
    elevation: 8, shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  circleDecorationTop: {
    position: 'absolute', right: -30, top: -50, width: 150, height: 150,
    borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.07)'
  },
  circleDecorationBottom: {
    position: 'absolute', right: -10, bottom: -70, width: 130, height: 130,
    borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.07)'
  },
  cardHeaderPreview: { flexDirection: 'row', justifyContent: 'space-between' },
  cardPreviewInstLabel: { color: colors.white, opacity: 0.7, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardPreviewNameText: { color: colors.white, fontSize: 19, fontWeight: '700', marginTop: 2 },
  cardPreviewNetworkText: { color: colors.white, fontSize: 15, fontWeight: '800', fontStyle: 'italic', opacity: 0.9 },
  cardPreviewDigitsText: { color: colors.white, fontSize: 16, letterSpacing: 2.5, opacity: 0.8 },
  cardPreviewFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardFooterLabel: { color: colors.white, fontSize: 10, opacity: 0.6, marginBottom: 2 },
  cardFooterValue: { color: colors.white, fontSize: 15, fontWeight: '700' },

  sectionLabel: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm, marginLeft: 4, fontWeight: '600' },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.xl },
  colorOption: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'white' },
  
  horizontalScroll: { marginBottom: spacing.lg },
  bankChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
  },
  bankChipText: { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },

  typeItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, marginRight: spacing.sm,
  },
  typeItemActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  typeLabel: { ...typography.caption, color: colors.textSecondary },
  typeLabelActive: { color: colors.primary, fontWeight: '700' },

  inputCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.md, minHeight: 56,
  },
  inputLabel: { fontSize: 14, color: colors.textSecondary },
  textInput: { flex: 1, fontSize: 14, color: colors.textPrimary, marginLeft: spacing.md },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },

  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  cancelButton: {
    flex: 1, height: 52, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  cancelButtonText: { fontWeight: '600', color: colors.textSecondary },
  saveButton: {
    flex: 1, height: 52, backgroundColor: colors.primary, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  saveButtonText: { fontWeight: '700', color: colors.white },
});