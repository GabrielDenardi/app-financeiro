import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Plus, 
  ChevronLeft, 
  AlertTriangle, 
  Receipt 
} from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme';
import { AddCardModal } from '../components/AddCardModal';
import { AddCardBillsModal } from '../components/AddCardBillsModal';


const { width } = Dimensions.get('window');

const MOCK_CARDS = [
  { 
    id: '1', 
    name: 'Nubank Principal', 
    institution: 'Nubank', 
    lastDigits: '4582', 
    limit: 5000, 
    usedLimit: 1250.50, 
    dueDay: 10, 
    closingDay: 3, 
    color: ['#8A05BE', '#530275'], 
    network: 'Mastercard' 
  },
  { 
    id: '2', 
    name: 'Inter Black', 
    institution: 'Inter', 
    lastDigits: '9901', 
    limit: 15000, 
    usedLimit: 4800, 
    dueDay: 25, 
    closingDay: 18, 
    color: ['#FF7A00', '#CC6200'], 
    network: 'Visa' 
  },
];

export default function CardsScreen({ navigation }: any) {
  const totalInvoice = 6050.50;
  const urgentAlerts = 1;
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isAddCardBillsModalVisible, setIsAddCardBillsModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <LinearGradient
            colors={[colors.primary, colors.primary]} 
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.headerContent}>
                <View style={styles.headerTop}>
                  <TouchableOpacity 
                    onPress={() => navigation.goBack()} 
                    style={styles.backButton}
                  >
                    <ChevronLeft color={colors.white} size={24} />
                  </TouchableOpacity>
                  
                  <Text style={styles.headerTitle}>Meus Cartões</Text>
                  
                  <TouchableOpacity 
                    style={styles.addButton} 
                    onPress={() => setIsAddModalVisible(true)}
                  >
                        <Plus color={colors.white} size={20} />
                        <Text style={styles.addButtonText}>Novo</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Total Faturas</Text>
                    <Text style={styles.statValue}>
                      R$ {totalInvoice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </Text>
                  </View>
                  
                  <View style={styles.statDivider} />
                  
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Alertas</Text>
                    <Text style={[styles.statValue, { color: '#FCD34D' }]}>
                      {urgentAlerts}
                    </Text>
                  </View>
                </View>
              </View>
            </SafeAreaView>
          </LinearGradient>
        </View>

        <View style={styles.mainContent}>
          {urgentAlerts > 0 && (
            <View style={styles.alertCard}>
              <View style={styles.alertIcon}>
                <AlertTriangle color="#d97706" size={20} />
              </View>
              <View style={styles.alertTextContent}>
                <Text style={styles.alertTitle}>Nubank Principal</Text>
                <Text style={styles.alertSubtitle}>Fatura vence em 3 dias • R$ 1.250,50</Text>
              </View>
              <TouchableOpacity style={styles.alertAction}>
                <Text style={styles.alertActionText}>Pagar</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.sectionLabel}>Cartões Ativos</Text>
          
          {MOCK_CARDS.map((card) => {
            const limitProgress = (card.usedLimit / card.limit) * 100;
            return (
              <View key={card.id} style={styles.cardWrapper}>
                <TouchableOpacity activeOpacity={0.9}>
                  <LinearGradient
                    colors={card.color as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardVisual}
                  >
                    <View style={styles.cardDecorator1} />
                    <View style={styles.cardDecorator2} />
                    <View style={styles.cardHeader}>
                      <View>
                        <Text style={styles.cardInst}>{card.institution}</Text>
                        <Text style={styles.cardName}>{card.name}</Text>
                      </View>
                      <Text style={styles.cardNetwork}>{card.network}</Text>
                    </View>
                    <Text style={styles.cardDigits}>•••• •••• •••• {card.lastDigits}</Text>
                    <View style={styles.cardFooter}>
                      <View>
                        <Text style={styles.cardLabel}>Vencimento</Text>
                        <Text style={styles.cardInfo}>Dia {card.dueDay}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.cardLabel}>Limite Disp.</Text>
                        <Text style={styles.cardInfo}>
                          R$ {(card.limit - card.usedLimit).toLocaleString('pt-BR')}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.cardStatsRow}>
                  <View style={styles.cardMiniStat}>
                    <Text style={styles.miniStatLabel}>Fatura Atual</Text>
                    <Text style={styles.miniStatValue}>R$ {card.usedLimit.toFixed(2)}</Text>
                  </View>
                  <View style={styles.miniStatDivider} />
                  <View style={styles.cardMiniStat}>
                    <Text style={styles.miniStatLabel}>Limite Usado</Text>
                    <View style={styles.progressContainer}>
                      <View style={[styles.progressBar, { width: `${limitProgress}%` }]} />
                    </View>
                  </View>
                </View>
              </View>
            );
          })}

          <TouchableOpacity 
            style={styles.quickAddExpense}
            onPress={() => setIsAddCardBillsModalVisible(true)}
          >
            <Receipt size={20} color={colors.primary} />
            <Text style={styles.quickAddText}>Lançar compra</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <AddCardModal 
        visible={isAddModalVisible} 
        onClose={() => setIsAddModalVisible(false)} 
      />

      <AddCardBillsModal 
        visible={isAddCardBillsModalVisible} 
        onClose={() => setIsAddModalVisible(false)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  scrollContent: { 
    paddingBottom: 40 
  },
  safeArea: {
    flex: 1,
  },
  header: { 
    minHeight: 220, 
    width: '100%',
    backgroundColor: 'transparent', 
  },
  headerGradient: { 
    flex: 1, 
    paddingTop: Platform.OS === 'ios' ? 0 : spacing.md, 
    paddingBottom: spacing.xl + 10,
    borderBottomLeftRadius: radius.lg * 1.5,
    borderBottomRightRadius: radius.lg * 1.5,
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  headerContent: { 
    paddingHorizontal: spacing.xl 
  },
  headerTop: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginTop: spacing.md, 
    marginBottom: spacing.xl
  },
  headerTitle: { 
    ...typography.h2, 
    color: colors.white 
  },
  backButton: { 
    padding: 8, 
    marginLeft: -8 
  },
  addButton: {
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4
  },
  addButtonText: { 
    color: colors.white, 
    fontWeight: '600', 
    fontSize: 12 
  },
  statsRow: {
    flexDirection: 'row', 
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.lg, 
    padding: spacing.lg,
  },
  statItem: { 
    flex: 1, 
    alignItems: 'center' 
  },
  statLabel: { 
    ...typography.caption, 
    color: 'rgba(255,255,255,0.8)', 
    marginBottom: 4 
  },
  statValue: { 
    ...typography.h2, 
    color: colors.white 
  },
  statDivider: { 
    width: 1, 
    height: 30, 
    backgroundColor: 'rgba(255,255,255,0.2)' 
  },
  mainContent: { 
    paddingHorizontal: spacing.xl, 
    marginTop: 24 
  },
  alertCard: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff7ed',
    borderWidth: 1, 
    borderColor: '#ffedd5', 
    borderRadius: radius.lg,
    padding: spacing.md, 
    marginBottom: spacing.xl,
    elevation: 2, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, 
    shadowRadius: 2,
  },
  alertIcon: { 
    padding: 8, 
    backgroundColor: '#ffedd5', 
    borderRadius: radius.md 
  },
  alertTextContent: { 
    flex: 1, 
    marginLeft: spacing.md 
  },
  alertTitle: { 
    ...typography.body, 
    fontWeight: '700', 
    color: '#9a3412' 
  },
  alertSubtitle: { 
    ...typography.caption, 
    color: '#c2410c' 
  },
  alertAction: { 
    paddingHorizontal: spacing.md, 
    paddingVertical: 6, 
    backgroundColor: '#f97316', 
    borderRadius: radius.pill 
  },
  alertActionText: { 
    ...typography.caption, 
    color: colors.white, 
    fontWeight: '700' 
  },
  sectionLabel: { 
    ...typography.body, 
    fontWeight: '700', 
    color: colors.textPrimary, 
    marginBottom: spacing.md 
  },
  cardWrapper: { 
    marginBottom: spacing.xl 
  },
  cardVisual: {
    height: 190, 
    borderRadius: 24, 
    padding: 24, 
    overflow: 'hidden',
    elevation: 8, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, 
    shadowRadius: 8,
  },
  cardDecorator1: {
    position: 'absolute', 
    top: -20, 
    right: -20, 
    width: 120, 
    height: 120,
    borderRadius: 60, 
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  cardDecorator2: {
    position: 'absolute', 
    bottom: 20, 
    right: 10, 
    width: 80, 
    height: 80,
    borderRadius: 40, 
    backgroundColor: 'rgba(255,255,255,0.05)'
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 30 
  },
  cardInst: { 
    ...typography.caption, 
    color: colors.white, 
    opacity: 0.7, 
    fontSize: 10, 
    fontWeight: '600'
  },
  cardName: { 
    ...typography.h2, 
    color: colors.white, 
    fontSize: 19, 
    fontWeight: '600', 
    marginTop: 2
  },
  cardNetwork: { 
    ...typography.caption, 
    color: colors.white, 
    fontSize: 15, 
    fontWeight: '600', 
    fontStyle: 'italic' 
  },
  cardDigits: { 
    ...typography.body, 
    color: colors.white, 
    fontSize: 16, 
    letterSpacing: 2.5, 
    opacity: 0.8 
  },
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end'
  },
  cardLabel: { 
    ...typography.caption, 
    color: 'rgba(255,255,255,0.5)', 
    fontSize: 10 
  },
  cardInfo: { 
    ...typography.body, 
    color: colors.white, 
    fontSize: 15, 
    fontWeight: '600'
  },
  cardStatsRow: {
    flexDirection: 'row', 
    backgroundColor: colors.surface,
    marginTop: -15, 
    marginHorizontal: 15, 
    borderRadius: radius.md,
    borderWidth: 1, 
    borderColor: colors.border, 
    padding: 12,
    zIndex: -1, 
    paddingTop: 25
  },
  cardMiniStat: { 
    flex: 1, 
    alignItems: 'center' 
  },
  miniStatLabel: { 
    ...typography.caption, 
    color: colors.textSecondary, 
    fontSize: 10 
  },
  miniStatValue: { 
    ...typography.body, 
    fontWeight: '700', 
    color: colors.textPrimary, 
    fontSize: 12 
  },
  miniStatDivider: { 
    width: 1, 
    backgroundColor: colors.border, 
    height: '100%' 
  },
  progressContainer: { 
    width: '80%', 
    height: 4, 
    backgroundColor: colors.border, 
    borderRadius: 2, 
    marginTop: 6 
  },
  progressBar: { 
    height: '100%', 
    backgroundColor: colors.primary, 
    borderRadius: 2 
  },
  quickAddExpense: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8, 
    padding: spacing.lg, 
    borderRadius: radius.lg,
    borderWidth: 2, 
    borderColor: colors.primary, 
    borderStyle: 'dashed',
    marginTop: spacing.sm,
    marginBottom: spacing.xl
  },
  quickAddText: { 
    ...typography.body, 
    color: colors.primary, 
    fontWeight: '600' 
  }
});