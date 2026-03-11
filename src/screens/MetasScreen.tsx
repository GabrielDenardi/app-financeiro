import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Plus, Trash2, X } from 'lucide-react-native';

import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { useAccounts } from '../features/accounts/hooks/useAccounts';
import {
  useCreateGoalMutation,
  useDeleteGoalMutation,
  useGoalContributionMutation,
  useGoals,
  useUpdateGoalMutation,
} from '../features/goals/hooks/useGoals';
import { formatCurrencyBRL } from '../utils/format';
import { colors, radius, spacing, typography } from '../theme';

const GOAL_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#DB2777', '#7C3AED'];
const GOAL_ICONS = ['target', 'car', 'home', 'plane', 'wallet'];

export default function MetasScreen() {
  const currentUser = useAuthenticatedUser();
  const goalsQuery = useGoals(currentUser?.id);
  const accountsQuery = useAccounts(currentUser?.id);
  const createGoalMutation = useCreateGoalMutation(currentUser?.id);
  const deleteGoalMutation = useDeleteGoalMutation(currentUser?.id);
  const contributeGoalMutation = useGoalContributionMutation(currentUser?.id);
  const updateGoalMutation = useUpdateGoalMutation(currentUser?.id);

  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [createVisible, setCreateVisible] = useState(false);
  const [contributionVisible, setContributionVisible] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [selectedColor, setSelectedColor] = useState(GOAL_COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(GOAL_ICONS[0]);
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionAccountId, setContributionAccountId] = useState('');
  const [contributionNote, setContributionNote] = useState('');

  const goals = goalsQuery.data ?? [];
  const filteredGoals = goals.filter((goal) => (activeTab === 'active' ? goal.status !== 'completed' : goal.status === 'completed'));
  const activeAccounts = (accountsQuery.data ?? []).filter((account) => account.isActive);

  const selectedGoal = useMemo(
    () => goals.find((goal) => goal.id === selectedGoalId) ?? null,
    [goals, selectedGoalId],
  );

  const openContributionModal = (goalId: string) => {
    setSelectedGoalId(goalId);
    setContributionAccountId(activeAccounts[0]?.id ?? '');
    setContributionVisible(true);
  };

  const handleCreateGoal = async () => {
    try {
      await createGoalMutation.mutateAsync({
        title,
        targetAmount: Number(targetAmount.replace(/\./g, '').replace(',', '.') || 0),
        initialAmount: Number(initialAmount.replace(/\./g, '').replace(',', '.') || 0),
        targetDate: targetDate || null,
        color: selectedColor,
        icon: selectedIcon,
      });

      setCreateVisible(false);
      setTitle('');
      setTargetAmount('');
      setInitialAmount('');
      setTargetDate('');
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel criar a meta.');
    }
  };

  const handleContribution = async () => {
    if (!selectedGoalId || !contributionAccountId) {
      return;
    }

    try {
      await contributeGoalMutation.mutateAsync({
        goalId: selectedGoalId,
        accountId: contributionAccountId,
        amount: Number(contributionAmount.replace(/\./g, '').replace(',', '.') || 0),
        note: contributionNote,
      });

      setContributionVisible(false);
      setContributionAmount('');
      setContributionNote('');
      setSelectedGoalId(null);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel registrar o aporte.');
    }
  };

  const handleDelete = async (goalId: string) => {
    try {
      await deleteGoalMutation.mutateAsync(goalId);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel excluir a meta.');
    }
  };

  const handleUpdateDeadline = async (goalId: string, nextDate: string) => {
    try {
      await updateGoalMutation.mutateAsync({
        id: goalId,
        targetDate: nextDate || null,
      });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel atualizar o prazo.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Metas financeiras</Text>
            <Text style={styles.subtitle}>Aportes deduzem saldo de conta e progridem no banco.</Text>
          </View>
          <Pressable style={styles.addButton} onPress={() => setCreateVisible(true)}>
            <Plus color={colors.white} size={18} />
            <Text style={styles.addButtonText}>Nova</Text>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          <Pressable style={[styles.tab, activeTab === 'active' && styles.tabActive]} onPress={() => setActiveTab('active')}>
            <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
              Ativas ({goals.filter((goal) => goal.status !== 'completed').length})
            </Text>
          </Pressable>
          <Pressable style={[styles.tab, activeTab === 'completed' && styles.tabActive]} onPress={() => setActiveTab('completed')}>
            <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
              Concluidas ({goals.filter((goal) => goal.status === 'completed').length})
            </Text>
          </Pressable>
        </View>

        <View style={styles.listCard}>
          {goalsQuery.isLoading ? (
            <ActivityIndicator />
          ) : filteredGoals.length ? (
            filteredGoals.map((goal) => (
              <View key={goal.id} style={[styles.goalCard, { borderLeftColor: goal.color }]}>
                <View style={styles.goalHeader}>
                  <View style={styles.goalHeaderText}>
                    <Text style={styles.goalTitle}>{goal.title}</Text>
                    <Text style={styles.goalMeta}>
                      {formatCurrencyBRL(goal.currentAmount)} de {formatCurrencyBRL(goal.targetAmount)}
                    </Text>
                    <Text style={styles.goalMeta}>Prazo: {goal.targetDate ?? 'Nao definido'}</Text>
                  </View>
                  <Pressable onPress={() => handleDelete(goal.id)}>
                    <Trash2 size={18} color={colors.danger} />
                  </Pressable>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(goal.progressPercent, 100)}%`, backgroundColor: goal.color }]} />
                </View>
                <Text style={styles.goalMeta}>{goal.progressPercent.toFixed(1)}% concluido</Text>
                {goal.status !== 'completed' ? (
                  <View style={styles.goalActions}>
                    <Pressable style={styles.secondaryButton} onPress={() => openContributionModal(goal.id)}>
                      <Text style={styles.secondaryButtonText}>Adicionar aporte</Text>
                    </Pressable>
                    <Pressable style={styles.secondaryButton} onPress={() => handleUpdateDeadline(goal.id, '')}>
                      <Text style={styles.secondaryButtonText}>Limpar prazo</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>As metas criadas e concluídas vao aparecer aqui.</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCreateVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova meta</Text>
              <Pressable onPress={() => setCreateVisible(false)}>
                <X size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <TextInput
              placeholder="Nome da meta"
              value={title}
              onChangeText={setTitle}
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              placeholder="Valor alvo"
              value={targetAmount}
              onChangeText={setTargetAmount}
              keyboardType="decimal-pad"
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              placeholder="Valor inicial"
              value={initialAmount}
              onChangeText={setInitialAmount}
              keyboardType="decimal-pad"
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              placeholder="Prazo (YYYY-MM-DD)"
              value={targetDate}
              onChangeText={setTargetDate}
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.modalLabel}>Cor</Text>
            <View style={styles.chipsWrap}>
              {GOAL_COLORS.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setSelectedColor(color)}
                  style={[styles.colorCircle, { backgroundColor: color }, selectedColor === color && styles.colorCircleActive]}
                />
              ))}
            </View>

            <Text style={styles.modalLabel}>Icone</Text>
            <View style={styles.chipsWrap}>
              {GOAL_ICONS.map((icon) => (
                <Pressable
                  key={icon}
                  onPress={() => setSelectedIcon(icon)}
                  style={[styles.filterChip, selectedIcon === icon && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, selectedIcon === icon && styles.filterChipTextActive]}>{icon}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setCreateVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, (!title || createGoalMutation.isPending) && styles.primaryButtonDisabled]}
                onPress={handleCreateGoal}
                disabled={!title || createGoalMutation.isPending}
              >
                {createGoalMutation.isPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Criar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={contributionVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setContributionVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setContributionVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adicionar aporte</Text>
              <Pressable onPress={() => setContributionVisible(false)}>
                <X size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.modalGoalTitle}>{selectedGoal?.title ?? 'Meta'}</Text>
            <TextInput
              placeholder="Valor do aporte"
              value={contributionAmount}
              onChangeText={setContributionAmount}
              keyboardType="decimal-pad"
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              placeholder="Observacao"
              value={contributionNote}
              onChangeText={setContributionNote}
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.modalLabel}>Conta de origem</Text>
            <View style={styles.chipsWrap}>
              {activeAccounts.map((account) => (
                <Pressable
                  key={account.id}
                  onPress={() => setContributionAccountId(account.id)}
                  style={[styles.filterChip, contributionAccountId === account.id && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, contributionAccountId === account.id && styles.filterChipTextActive]}>
                    {account.name}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setContributionVisible(false)}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, (!contributionAccountId || contributeGoalMutation.isPending) && styles.primaryButtonDisabled]}
                onPress={handleContribution}
                disabled={!contributionAccountId || contributeGoalMutation.isPending}
              >
                {contributeGoalMutation.isPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  addButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  addButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.surface,
  },
  tabText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  tabTextActive: {
    color: colors.textPrimary,
  },
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  goalCard: {
    borderLeftWidth: 4,
    paddingLeft: spacing.md,
    gap: spacing.sm,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  goalHeaderText: {
    flex: 1,
  },
  goalTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  goalMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.mutedSurface,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  modalGoalTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  modalLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  modalInput: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorCircleActive: {
    borderWidth: 2,
    borderColor: colors.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
});
