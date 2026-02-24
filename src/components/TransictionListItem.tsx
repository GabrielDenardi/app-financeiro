import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RecentTransaction } from '../types/finance';
import { colors, radius, spacing, typography } from '../theme';
import { formatCurrency } from '../utils/format';
// Importação dos ícones
import { 
  Fuel, 
  Utensils, 
  ShoppingBag, 
  Zap, 
  HeartPulse, 
  DollarSign, 
  HelpCircle 
} from 'lucide-react-native';

// Função para mapear ícone por categoria
const getIcon = (category: string) => {
  const cat = category.toLowerCase();
  if (cat.includes('combustivel') || cat.includes('transporte')) return <Fuel size={20} color={colors.textSecondary} />;
  if (cat.includes('alimentação') || cat.includes('restaurante')) return <Utensils size={20} color={colors.textSecondary} />;
  if (cat.includes('compras') || cat.includes('mercado')) return <ShoppingBag size={20} color={colors.textSecondary} />;
  if (cat.includes('contas') || cat.includes('luz')) return <Zap size={20} color={colors.textSecondary} />;
  if (cat.includes('saúde') || cat.includes('farmácia')) return <HeartPulse size={20} color={colors.textSecondary} />;
  if (cat.includes('salário') || cat.includes('receita')) return <DollarSign size={20} color={colors.textSecondary} />;
  
  return <HelpCircle size={20} color={colors.textSecondary} />;
};

export const TransactionListItem = ({ item }: { item: RecentTransaction }) => {
  const isIncome = item.type === 'income';

  return (
    <View style={styles.container}>
      {/* Ícone dinâmico baseado na categoria */}
      <View style={styles.iconContainer}>
        {getIcon(item.category)}
      </View>
      
      <View style={styles.details}>
        <Text style={styles.title}>{item.title}</Text>
        <View style={styles.subtitleContainer}>
          <Text style={styles.subtitle}>{item.date}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.paymentMethod}</Text>
          </View>
        </View>
      </View>

      <View style={styles.amountContainer}>
        <Text style={[styles.amount, { color: isIncome ? colors.success : colors.danger }]}>
          {isIncome ? '+ ' : '- '}{formatCurrency(item.amount)}
        </Text>
        <Text style={styles.category}>{item.category}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.mutedSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  details: { flex: 1, marginLeft: spacing.md },
  title: { 
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary 
  },
  subtitleContainer: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  subtitle: { 
    ...typography.caption, 
    color: colors.textSecondary 
  },
  badge: { 
    backgroundColor: colors.mutedSurface, 
    paddingHorizontal: spacing.sm, 
    paddingVertical: 2, 
    borderRadius: radius.sm, 
    marginLeft: spacing.sm 
  },
  badgeText: { 
    fontSize: 10, 
    fontWeight: '700', 
    color: colors.textPrimary 
  },
  amountContainer: { alignItems: 'flex-end' },
  amount: { 
    ...typography.body,
    fontWeight: '700' 
  },
  category: { 
    ...typography.caption, 
    color: colors.textSecondary, 
    marginTop: 2 
  }
});