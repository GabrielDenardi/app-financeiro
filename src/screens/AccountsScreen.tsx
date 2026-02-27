import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  ArrowLeft,
  Plus,
  Eye,
  EyeOff,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  CreditCard,
  Landmark,
} from 'lucide-react-native';
import { colors, spacing, radius, typography } from '../theme'; 
import { accountsMock, typeConfig } from '../data/accountsMock';

export function AccountsScreen({ navigation }: any) {
  const [showBalances, setShowBalances] = useState(true);

  const totalBalance = accountsMock.reduce((sum, a) => sum + a.balance, 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <View style={styles.headerBackground}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <TouchableOpacity 
              onPress={() => navigation?.goBack()} 
              style={styles.headerIconButton}
            >
              <ArrowLeft color={colors.white} size={22} />
            </TouchableOpacity>
            
            <Text style={[typography.h2, { color: colors.white }]}>Minhas Contas</Text>
            
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.actionButtonGhost}>
                <RefreshCw color={colors.white} size={14} />
                <Text style={{color: colors.white}}>Transferir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButtonSolid}>
                <Plus color={colors.white} size={14} />
                <Text style={{color: colors.white}}>Novo</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.totalCard}>
            <View style={styles.totalRow}>
              <Text style={[typography.caption, { color: 'rgba(255,255,255,0.7)' }]}>
                Patrimônio Líquido
              </Text>
              <TouchableOpacity onPress={() => setShowBalances(!showBalances)}>
                {showBalances ? 
                  <Eye color={colors.white} size={18} opacity={0.6} /> : 
                  <EyeOff color={colors.white} size={18} opacity={0.6} />
                }
              </TouchableOpacity>
            </View>
            <Text style={[typography.h1, { color: colors.white, fontSize: 32, marginTop: spacing.xs }]}>
              {showBalances ? `R$ ${totalBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ••••••'}
            </Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[typography.caption, { color: 'rgba(255,255,255,0.5)' }]}>Ativos</Text>
                <Text style={[typography.body, { color: colors.white, fontWeight: '700' }]}>{showBalances ? `R$ 17.620,00` : 'R$ ••••'}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[typography.caption, { color: 'rgba(255,255,255,0.5)' }]}>Dívidas</Text>
                <Text style={[typography.body, { color: colors.danger, fontWeight: '700' }]}>{showBalances ? `R$ 0,00` : 'R$ ••••'}</Text>
              </View>
            <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[typography.caption, { color: 'rgba(255,255,255,0.5)' }]}>Contas</Text>
                <Text style={[typography.body, { color: colors.white, fontWeight: '700' }]}>0</Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView 
        style={styles.scrollContent} 
        contentContainerStyle={styles.scrollPadding}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryBox}>
              <View style={styles.summaryLabelRow}>
                <ArrowUpRight size={14} color={colors.success} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Entradas</Text>
              </View>
              <Text style={[typography.h2, { color: colors.success }]}>{showBalances ? `R$ 4.500,00` : 'R$ ••••••'}</Text>
            </View>
            
            <View style={styles.verticalDivider} />

            <View style={styles.summaryBox}>
              <View style={styles.summaryLabelRow}>
                <ArrowDownRight size={14} color={colors.danger} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Saídas</Text>
              </View>
              <Text style={[typography.h2, { color: colors.danger }]}>{showBalances ? `R$ 2.100,00` : 'R$ ••••••'}</Text>
            </View>
          </View>
          
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: '55%' }]} />
          </View>
        </View>

        <Text style={[typography.h2, { color: colors.textPrimary, marginBottom: spacing.md }]}>
          Suas Contas
        </Text>

        {accountsMock.map((acc) => {
        const config = typeConfig[acc.type];
        return (
            <TouchableOpacity key={acc.id} style={styles.accountCard}>
            {/* LADO ESQUERDO: Informações */}
            <View style={styles.accountMainInfo}>
                {/* Linha 1: Ícone + Tipo */}
                <View style={styles.accountTypeRow}>
                <View style={styles.typeIconContainer}>
                    <config.icon size={12} color={colors.primary} />
                </View>
                <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '500' }]}>
                    {config.label}
                </Text>
                </View>

                {/* Linha 2: Apelido da Conta */}
                <Text style={[typography.h2, { color: colors.textPrimary, marginVertical: 2 }]}>
                {acc.name}
                </Text>

                {/* Linha 3: Ícone Banco + Instituição */}
                <View style={styles.institutionRow}>
                <Landmark size={12} color={colors.textSecondary} />
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {acc.institution || 'Não informada'}
                </Text>
                </View>
            </View>

            {/* LADO DIREITO: Saldo */}
            <View style={styles.accountBalanceWrapper}>
                <View style={styles.balanceTextContainer}>
                <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'right' }]}>
                    Saldo
                </Text>
                <Text style={[typography.h2, { color: colors.textPrimary, textAlign: 'right' }]}>
                    {showBalances ? `R$ ${acc.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '••••'}
                </Text>
                </View>
                <ChevronRight size={16} color={colors.border} />
            </View>
            </TouchableOpacity>
        );
        })}

        <View style={styles.quickActions}>

        <TouchableOpacity style={styles.quickActionCard}>
            <View style={styles.quickActionContent}>
            <View style={styles.quickActionIcon}>
                <CreditCard size={20} color={colors.primary} />
            </View>
            <View>
                <Text style={[typography.body, { fontWeight: '600', color: colors.textPrimary }]}>
                Cartões
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Gerenciar faturas
                </Text>
            </View>
            </View>
            <ChevronRight size={18} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionCard}>
            <View style={styles.quickActionContent}>
            <View style={styles.quickActionIcon}>
                <RefreshCw size={20} color={colors.primary} />
            </View>
            <View>
                <Text style={[typography.body, { fontWeight: '600', color: colors.textPrimary }]}>
                Transferir
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Entre suas contas
                </Text>
            </View>
            </View>
            <ChevronRight size={18} color={colors.border} />
        </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerBackground: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingBottom: 70, 
    borderBottomLeftRadius: radius.lg * 2,
    borderBottomRightRadius: radius.lg * 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  headerIconButton: {
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  actionButtonGhost: {
    padding: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center'
  },
  actionButtonSolid: {
    padding: spacing.md,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center'
  },
  totalCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statsGrid: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statItem: { flex: 1 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: spacing.md },
  
  scrollContent: { flex: 1, marginTop: -50 },
  scrollPadding: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  summaryBox: { flex: 1 },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  verticalDivider: { width: 1, height: '100%', backgroundColor: colors.border, marginHorizontal: spacing.md },
  progressBg: { height: 6, backgroundColor: colors.mutedSurface, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.success },

  accountCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
    accountMainInfo: {
    flex: 1,
    gap: 2,
  },
    accountTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
    typeIconContainer: {
    padding: 4,
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.pill,
  },
    institutionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
    accountBalanceWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
    balanceTextContainer: {
    justifyContent: 'center',
  },

    quickActions: { 
        gap: spacing.sm, 
        marginTop: spacing.md, 
        flexDirection: 'row'
    },
    quickActionCard: {
        flexDirection: 'row', 
        alignItems: 'center',
        justifyContent: 'space-between', 
        backgroundColor: colors.surface,
        padding: spacing.sm,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        marginRight: 1,
        marginLeft: 1,
    },
    quickActionContent: {
        flexDirection: 'row', 
        alignItems: 'center',
        gap: spacing.md, 
    },
    quickActionIcon: {
        width: 44,
        height: 44,
        backgroundColor: colors.mutedSurface,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
});