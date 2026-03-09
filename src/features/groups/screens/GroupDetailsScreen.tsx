import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card } from '../../../components/Card';
import { colors, radius, spacing, typography } from '../../../theme';
import type { AuthenticatedUserSummary } from '../../../types/auth';
import type {
  GroupBalanceRow,
  GroupMember,
  GroupSettlement,
  GroupSplitKind,
  SettlementPaymentMethod,
  SplitMode,
} from '../../../types/groups';
import { formatCurrencyBRL } from '../../../utils/format';
import {
  useConfirmSettlementMutation,
  useCreateGroupSplitMutation,
  useGroupDetails,
  useRemoveGroupMemberMutation,
  useRequestSettlementMutation,
} from '../hooks/useGroups';
import {
  createEqualShares,
  createPercentageShares,
  validateCustomShares,
} from '../utils/groupMath';

type GroupDetailsScreenProps = {
  currentUser: AuthenticatedUserSummary | null;
  groupId: string;
};

type DetailsTab = 'balances' | 'splits' | 'settlements' | 'members';

const TABS: Array<{ key: DetailsTab; label: string }> = [
  { key: 'balances', label: 'Saldos' },
  { key: 'splits', label: 'Divisoes' },
  { key: 'settlements', label: 'Acertos' },
  { key: 'members', label: 'Membros' },
];

const PAYMENT_METHODS: SettlementPaymentMethod[] = ['PIX', 'Dinheiro', 'Transferencia'];

function parseDecimal(value: string) {
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNetAmount(amount: number) {
  if (amount > 0) {
    return `+ ${formatCurrencyBRL(amount)}`;
  }

  if (amount < 0) {
    return `- ${formatCurrencyBRL(Math.abs(amount))}`;
  }

  return formatCurrencyBRL(0);
}

function sortMembers(members: GroupMember[]) {
  return [...members].sort((left, right) => left.fullName.localeCompare(right.fullName));
}

export function GroupDetailsScreen({ currentUser, groupId }: GroupDetailsScreenProps) {
  const navigation = useNavigation<any>();
  const currentUserId = currentUser?.id ?? null;
  const groupDetailsQuery = useGroupDetails(currentUserId, groupId);
  const createSplitMutation = useCreateGroupSplitMutation(currentUserId, groupId);
  const requestSettlementMutation = useRequestSettlementMutation(currentUserId, groupId);
  const confirmSettlementMutation = useConfirmSettlementMutation(currentUserId, groupId);
  const removeMemberMutation = useRemoveGroupMemberMutation(currentUserId, groupId);

  const [activeTab, setActiveTab] = useState<DetailsTab>('balances');
  const [isSplitModalVisible, setIsSplitModalVisible] = useState(false);
  const [isSettlementModalVisible, setIsSettlementModalVisible] = useState(false);
  const [splitTitle, setSplitTitle] = useState('');
  const [splitDescription, setSplitDescription] = useState('');
  const [splitKind, setSplitKind] = useState<GroupSplitKind>('expense');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [splitTotal, setSplitTotal] = useState('');
  const [splitOwnerUserId, setSplitOwnerUserId] = useState(currentUserId ?? '');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [percentageByUserId, setPercentageByUserId] = useState<Record<string, string>>({});
  const [customAmountByUserId, setCustomAmountByUserId] = useState<Record<string, string>>({});
  const [selectedBalance, setSelectedBalance] = useState<GroupBalanceRow | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementMethod, setSettlementMethod] = useState<SettlementPaymentMethod>('PIX');
  const [settlementNote, setSettlementNote] = useState('');

  const groupData = groupDetailsQuery.data;
  const members = useMemo(
    () => sortMembers((groupData?.members ?? []).filter((member) => member.removedAt === null)),
    [groupData?.members],
  );
  const membersById = useMemo(() => new Map(members.map((member) => [member.userId, member])), [members]);

  const resetSplitForm = () => {
    setSplitTitle('');
    setSplitDescription('');
    setSplitKind('expense');
    setSplitMode('equal');
    setSplitTotal('');
    setSplitOwnerUserId(currentUserId ?? members[0]?.userId ?? '');
    setSelectedMemberIds(members.map((member) => member.userId));
    setPercentageByUserId({});
    setCustomAmountByUserId({});
  };

  const resolveMemberName = (userId: string) => {
    if (userId === currentUserId) {
      return 'Voce';
    }

    return membersById.get(userId)?.fullName ?? 'Membro';
  };

  const splitPreview = useMemo(() => {
    const totalAmount = parseDecimal(splitTotal);

    if (totalAmount <= 0 || selectedMemberIds.length === 0) {
      return { shares: [], error: '' };
    }

    try {
      if (splitMode === 'equal') {
        return { shares: createEqualShares(totalAmount, selectedMemberIds), error: '' };
      }

      if (splitMode === 'percentage') {
        return {
          shares: createPercentageShares(
            totalAmount,
            selectedMemberIds.map((userId) => ({
              userId,
              percentage: parseDecimal(percentageByUserId[userId] ?? ''),
            })),
          ),
          error: '',
        };
      }

      return {
        shares: validateCustomShares(
          totalAmount,
          selectedMemberIds.map((userId) => ({
            userId,
            amount: parseDecimal(customAmountByUserId[userId] ?? ''),
          })),
        ),
        error: '',
      };
    } catch (error) {
      return {
        shares: [],
        error: error instanceof Error ? error.message : 'Nao foi possivel calcular a divisao.',
      };
    }
  }, [customAmountByUserId, percentageByUserId, selectedMemberIds, splitMode, splitTotal]);

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((current) =>
      current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId],
    );
  };

  const handleOpenSplitModal = () => {
    resetSplitForm();
    setIsSplitModalVisible(true);
  };

  const handleShareCode = async () => {
    if (!groupData) {
      return;
    }

    try {
      await Share.share({
        message: `Entre no grupo "${groupData.group.title}" com o codigo ${groupData.group.shareCode}.`,
      });
    } catch (_error) {
      Alert.alert('Compartilhamento', 'Nao foi possivel compartilhar o codigo agora.');
    }
  };

  const handleSaveSplit = async () => {
    if (!currentUserId || !groupData) {
      return;
    }

    if (!splitTitle.trim()) {
      Alert.alert('Divisao', 'Informe um titulo.');
      return;
    }

    if (!splitOwnerUserId) {
      Alert.alert('Divisao', 'Selecione quem pagou ou recebeu.');
      return;
    }

    if (splitPreview.error) {
      Alert.alert('Divisao', splitPreview.error);
      return;
    }

    try {
      await createSplitMutation.mutateAsync({
        groupId,
        title: splitTitle,
        description: splitDescription,
        kind: splitKind,
        splitMode,
        totalAmount: parseDecimal(splitTotal),
        ownerUserId: splitOwnerUserId,
        occurredAt: new Date().toISOString(),
        shares: splitPreview.shares,
      });
      setIsSplitModalVisible(false);
      resetSplitForm();
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel registrar a divisao.');
    }
  };

  const handleOpenSettlementModal = (balance: GroupBalanceRow) => {
    setSelectedBalance(balance);
    setSettlementAmount(Math.abs(balance.amount).toFixed(2));
    setSettlementMethod('PIX');
    setSettlementNote('');
    setIsSettlementModalVisible(true);
  };

  const handleRequestSettlement = async () => {
    if (!selectedBalance) {
      return;
    }

    const amount = parseDecimal(settlementAmount);
    if (amount <= 0 || amount > Math.abs(selectedBalance.amount) + 0.009) {
      Alert.alert('Acerto', 'Informe um valor valido dentro do saldo pendente.');
      return;
    }

    try {
      await requestSettlementMutation.mutateAsync({
        groupId,
        toUserId: selectedBalance.userId,
        amount,
        paymentMethod: settlementMethod,
        note: settlementNote,
      });
      setIsSettlementModalVisible(false);
      setSelectedBalance(null);
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel solicitar o acerto.');
    }
  };

  const handleConfirmSettlement = (settlement: GroupSettlement) => {
    Alert.alert(
      'Confirmar acerto',
      `Confirmar o recebimento de ${formatCurrencyBRL(settlement.amount)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await confirmSettlementMutation.mutateAsync(settlement.id);
            } catch (error) {
              Alert.alert(
                'Erro',
                error instanceof Error ? error.message : 'Nao foi possivel confirmar o acerto.',
              );
            }
          },
        },
      ],
    );
  };

  const handleRemoveMember = (member: GroupMember) => {
    Alert.alert(
      'Remover membro',
      `Deseja remover ${member.fullName} do grupo?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMemberMutation.mutateAsync(member.userId);
            } catch (error) {
              Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel remover o membro.');
            }
          },
        },
      ],
    );
  };

  if (groupDetailsQuery.isLoading || !groupData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{groupData.group.title}</Text>
          <Text style={styles.headerSubtitle}>{groupData.group.description || 'Sem descricao.'}</Text>
        </View>

        <Pressable onPress={handleShareCode} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Ionicons name="share-social-outline" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.heroCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.heroMuted}>Codigo</Text>
              <Text style={styles.heroCode}>{groupData.group.shareCode}</Text>
            </View>

            <Pressable onPress={handleOpenSplitModal} style={({ pressed }) => [styles.primaryChipButton, pressed && styles.pressed]}>
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.primaryChipButtonText}>Nova divisao</Text>
            </Pressable>
          </View>

          <View style={styles.metricsRow}>
            <MetricCard label="Total dividido" value={formatCurrencyBRL(groupData.summary.totalDivided)} />
            <MetricCard label="Acertado" value={formatCurrencyBRL(groupData.summary.settled)} valueColor={colors.success} />
            <MetricCard label="Pendente" value={formatCurrencyBRL(groupData.summary.pending)} valueColor={colors.danger} />
          </View>

          <View>
            <Text style={styles.heroMuted}>Seu saldo no grupo</Text>
            <Text style={[styles.heroBalance, groupData.currentUserNet >= 0 ? styles.positive : styles.negative]}>
              {formatNetAmount(groupData.currentUserNet)}
            </Text>
          </View>
        </Card>

        <View style={styles.tabsRow}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={({ pressed }) => [
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === 'balances' ? (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Saldos entre voce e os outros membros</Text>
            <Text style={styles.sectionDescription}>
              Positivo indica credito. Negativo indica que voce deve para o membro.
            </Text>

            {groupData.balances.map((balance) => (
              <View key={balance.userId} style={styles.listRow}>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{balance.fullName}</Text>
                  <Text style={[styles.listAmount, balance.amount >= 0 ? styles.positive : styles.negative]}>
                    {formatNetAmount(balance.amount)}
                  </Text>
                </View>

                {balance.amount < -0.009 ? (
                  <Pressable onPress={() => handleOpenSettlementModal(balance)} style={({ pressed }) => [styles.smallActionButton, pressed && styles.pressed]}>
                    <Text style={styles.smallActionButtonText}>Pagar</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            {groupData.balances.length === 0 ? <Text style={styles.emptyText}>Nenhum saldo aberto.</Text> : null}
          </Card>
        ) : null}

        {activeTab === 'splits' ? (
          <>
            {groupData.splits.map((split) => (
              <Card key={split.id} style={styles.sectionCard}>
                <View style={styles.rowBetween}>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{split.title}</Text>
                      <Text style={styles.sectionDescription}>
                        {split.kind === 'expense' ? 'Despesa' : 'Receita'} {' - '}{resolveMemberName(split.ownerUserId)}
                      </Text>
                  </View>

                  <Text style={[styles.listAmount, split.kind === 'income' ? styles.positive : styles.negative]}>
                    {formatCurrencyBRL(split.totalAmount)}
                  </Text>
                </View>

                <Text style={styles.sectionDescription}>
                  {split.description || `${split.shares.length} participante(s) - modo ${split.splitMode}`}
                </Text>
              </Card>
            ))}

            {groupData.splits.length === 0 ? (
              <Card style={styles.sectionCard}>
                <Text style={styles.emptyText}>Nenhuma divisao registrada.</Text>
              </Card>
            ) : null}
          </>
        ) : null}

        {activeTab === 'settlements' ? (
          <>
            {groupData.settlements.map((settlement) => {
              const canConfirm = settlement.status === 'pending' && settlement.toUserId === currentUserId;
              const isOutgoing = settlement.fromUserId === currentUserId;

              return (
                <Card key={settlement.id} style={styles.sectionCard}>
                  <View style={styles.rowBetween}>
                    <View style={styles.listCopy}>
                      <Text style={styles.listTitle}>
                        {resolveMemberName(settlement.fromUserId)}
                        {' -> '}
                        {resolveMemberName(settlement.toUserId)}
                      </Text>
                      <Text style={styles.sectionDescription}>
                        {settlement.paymentMethod}
                        {' - '}
                        {settlement.status === 'confirmed' ? 'Confirmado' : 'Pendente'}
                      </Text>
                    </View>

                    <Text style={styles.listAmount}>{formatCurrencyBRL(settlement.amount)}</Text>
                  </View>

                  {settlement.note ? <Text style={styles.sectionDescription}>{settlement.note}</Text> : null}

                  {canConfirm ? (
                    <Pressable onPress={() => handleConfirmSettlement(settlement)} style={({ pressed }) => [styles.smallActionButton, pressed && styles.pressed]}>
                      <Text style={styles.smallActionButtonText}>
                        {confirmSettlementMutation.isPending ? 'Confirmando...' : 'Confirmar recebimento'}
                      </Text>
                    </Pressable>
                  ) : isOutgoing && settlement.status === 'pending' ? (
                    <Text style={styles.awaitingText}>Aguardando confirmacao do recebedor.</Text>
                  ) : null}
                </Card>
              );
            })}

            {groupData.settlements.length === 0 ? (
              <Card style={styles.sectionCard}>
                <Text style={styles.emptyText}>Nenhum acerto registrado.</Text>
              </Card>
            ) : null}
          </>
        ) : null}

        {activeTab === 'members' ? (
          <>
            {members.map((member) => {
              const canRemove =
                groupData.currentUserRole === 'admin' &&
                member.role !== 'admin' &&
                member.userId !== currentUserId;

              return (
                <Card key={member.userId} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{member.fullName.slice(0, 1).toUpperCase()}</Text>
                  </View>

                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle}>{member.userId === currentUserId ? 'Voce' : member.fullName}</Text>
                    <Text style={styles.sectionDescription}>
                      {member.role === 'admin' ? 'Administrador' : 'Membro'}
                    </Text>
                  </View>

                  {canRemove ? (
                    <Pressable onPress={() => handleRemoveMember(member)} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </Pressable>
                  ) : (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{member.role === 'admin' ? 'ADM' : 'Ativo'}</Text>
                    </View>
                  )}
                </Card>
              );
            })}
          </>
        ) : null}
      </ScrollView>

      <Modal transparent visible={isSplitModalVisible} animationType="slide" onRequestClose={() => setIsSplitModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
              <View style={styles.rowBetween}>
                <Text style={styles.modalTitle}>Registrar divisao</Text>
                <Pressable onPress={() => setIsSplitModalVisible(false)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                  <Ionicons name="close-outline" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <TextInput value={splitTitle} onChangeText={setSplitTitle} placeholder="Titulo" placeholderTextColor={colors.textSecondary} style={styles.input} />
              <TextInput value={splitDescription} onChangeText={setSplitDescription} placeholder="Descricao (opcional)" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.multilineInput]} multiline />
              <TextInput value={splitTotal} onChangeText={setSplitTotal} placeholder="Valor total" placeholderTextColor={colors.textSecondary} style={styles.input} keyboardType="decimal-pad" />

              <View style={styles.choiceRow}>
                {(['expense', 'income'] as GroupSplitKind[]).map((kind) => (
                  <ChoiceButton key={kind} label={kind === 'expense' ? 'Despesa' : 'Receita'} selected={splitKind === kind} onPress={() => setSplitKind(kind)} />
                ))}
              </View>

              <Text style={styles.fieldLabel}>{splitKind === 'expense' ? 'Quem pagou?' : 'Quem recebeu?'}</Text>
              <View style={styles.wrapRow}>
                {members.map((member) => (
                  <ChoiceButton key={member.userId} label={resolveMemberName(member.userId)} selected={splitOwnerUserId === member.userId} onPress={() => setSplitOwnerUserId(member.userId)} />
                ))}
              </View>

              <Text style={styles.fieldLabel}>Modo de divisao</Text>
              <View style={styles.wrapRow}>
                <ChoiceButton label="Igual" selected={splitMode === 'equal'} onPress={() => setSplitMode('equal')} />
                <ChoiceButton label="Por porcentagem" selected={splitMode === 'percentage'} onPress={() => setSplitMode('percentage')} />
                <ChoiceButton label="Personalizado" selected={splitMode === 'custom'} onPress={() => setSplitMode('custom')} />
              </View>

              <Text style={styles.fieldLabel}>Participantes</Text>
              <View style={styles.wrapRow}>
                {members.map((member) => (
                  <ChoiceButton key={member.userId} label={resolveMemberName(member.userId)} selected={selectedMemberIds.includes(member.userId)} onPress={() => toggleMember(member.userId)} />
                ))}
              </View>

              {splitMode !== 'equal' ? (
                <View style={styles.dynamicInputs}>
                  {selectedMemberIds.map((userId) => (
                    <View key={userId} style={styles.dynamicRow}>
                      <Text style={styles.dynamicLabel}>{resolveMemberName(userId)}</Text>
                      <TextInput
                        value={
                          splitMode === 'percentage'
                            ? percentageByUserId[userId] ?? ''
                            : customAmountByUserId[userId] ?? ''
                        }
                        onChangeText={(value) =>
                          splitMode === 'percentage'
                            ? setPercentageByUserId((current) => ({ ...current, [userId]: value }))
                            : setCustomAmountByUserId((current) => ({ ...current, [userId]: value }))
                        }
                        placeholder={splitMode === 'percentage' ? '%' : '0,00'}
                        placeholderTextColor={colors.textSecondary}
                        style={styles.dynamicInput}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ))}
                </View>
              ) : null}

              <Card style={styles.previewCard}>
                <Text style={styles.sectionTitle}>Preview</Text>
                {splitPreview.error ? <Text style={styles.errorText}>{splitPreview.error}</Text> : null}
                {splitPreview.shares.map((share) => (
                  <View key={share.userId} style={styles.rowBetween}>
                    <Text style={styles.sectionDescription}>{resolveMemberName(share.userId)}</Text>
                    <Text style={styles.listAmount}>{formatCurrencyBRL(share.amount)}</Text>
                  </View>
                ))}
                {!splitPreview.error && splitPreview.shares.length === 0 ? (
                  <Text style={styles.sectionDescription}>Preencha o valor e os participantes para ver o preview.</Text>
                ) : null}
              </Card>

              <View style={styles.modalActions}>
                <Pressable onPress={() => setIsSplitModalVisible(false)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                  <Text style={styles.secondaryButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={handleSaveSplit} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <Text style={styles.primaryButtonText}>{createSplitMutation.isPending ? 'Salvando...' : 'Salvar divisao'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </Card>
        </View>
      </Modal>

      <Modal transparent visible={isSettlementModalVisible} animationType="slide" onRequestClose={() => setIsSettlementModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Registrar pagamento</Text>
              <Pressable onPress={() => setIsSettlementModalVisible(false)} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                <Ionicons name="close-outline" size={20} color={colors.textPrimary} />
              </Pressable>
            </View>

            <Text style={styles.sectionDescription}>
              {selectedBalance ? `Acerto com ${selectedBalance.fullName}` : 'Acerto'}
            </Text>

            <TextInput value={settlementAmount} onChangeText={setSettlementAmount} placeholder="Valor" placeholderTextColor={colors.textSecondary} style={styles.input} keyboardType="decimal-pad" />

            <View style={styles.wrapRow}>
              {PAYMENT_METHODS.map((method) => (
                <ChoiceButton key={method} label={method} selected={settlementMethod === method} onPress={() => setSettlementMethod(method)} />
              ))}
            </View>

            <TextInput value={settlementNote} onChangeText={setSettlementNote} placeholder="Observacao (opcional)" placeholderTextColor={colors.textSecondary} style={[styles.input, styles.multilineInput]} multiline />

            <View style={styles.modalActions}>
              <Pressable onPress={() => setIsSettlementModalVisible(false)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleRequestSettlement} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>{requestSettlementMutation.isPending ? 'Enviando...' : 'Solicitar acerto'}</Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MetricCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

function ChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceButton,
        selected && styles.choiceButtonActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceButtonText, selected && styles.choiceButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  headerTitle: { ...typography.h2, color: colors.textPrimary },
  headerSubtitle: { ...typography.body, color: colors.textSecondary },
  iconButton: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  heroCard: { backgroundColor: '#0F766E', borderColor: '#0F766E', gap: spacing.md },
  heroMuted: { ...typography.caption, color: 'rgba(255,255,255,0.72)' },
  heroCode: { ...typography.h2, color: colors.white, letterSpacing: 1 },
  heroBalance: { ...typography.value, fontWeight: '700' },
  positive: { color: colors.success },
  negative: { color: colors.danger },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  primaryChipButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  primaryChipButtonText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  metricLabel: { ...typography.caption, color: colors.textSecondary },
  metricValue: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  tabsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  tabButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tabButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabButtonText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  tabButtonTextActive: { color: colors.white },
  sectionCard: { gap: spacing.sm },
  sectionTitle: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  sectionDescription: { ...typography.body, color: colors.textSecondary },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  listCopy: { flex: 1, gap: spacing.xs },
  listTitle: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  listAmount: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  smallActionButton: { minHeight: 38, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  smallActionButtonText: { ...typography.caption, color: colors.white, fontWeight: '700' },
  emptyText: { ...typography.body, color: colors.textSecondary },
  awaitingText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memberAvatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { ...typography.body, color: colors.primary, fontWeight: '700' },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.mutedSurface },
  badgeText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  removeButton: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'center', padding: spacing.lg },
  modalCard: { maxHeight: '90%', gap: spacing.md },
  modalContent: { gap: spacing.md },
  modalTitle: { ...typography.h2, color: colors.textPrimary },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.textPrimary },
  multilineInput: { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md },
  choiceRow: { flexDirection: 'row', gap: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  choiceButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  choiceButtonActive: { borderColor: colors.primary, backgroundColor: '#DBEAFE' },
  choiceButtonText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  choiceButtonTextActive: { color: colors.primary },
  dynamicInputs: { gap: spacing.sm },
  dynamicRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dynamicLabel: { flex: 1, ...typography.body, color: colors.textPrimary },
  dynamicInput: { width: 110, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, color: colors.textPrimary },
  previewCard: { gap: spacing.sm, backgroundColor: colors.mutedSurface },
  errorText: { ...typography.body, color: colors.danger },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: { flex: 1, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  primaryButton: { flex: 1, minHeight: 46, borderRadius: radius.md, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { ...typography.body, color: colors.white, fontWeight: '700' },
});
