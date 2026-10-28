import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { type ReactNode, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  Check,
  Copy,
  FileText,
  HandCoins,
  Image as ImageIcon,
  Lock,
  Plus,
  Receipt,
  RotateCcw,
  Share2,
  Trash2,
  Wallet,
  X,
} from 'lucide-react-native';

import { Badge } from '../../../components/Badge';
import { PageHeader } from '../../../components/PageHeader';
import { PageShell } from '../../../components/PageShell';
import { BottomSheet } from '../../../components/BottomSheet';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Chip } from '../../../components/Chip';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { FieldCard, FieldDivider, FieldRow } from '../../../components/FormField';
import { useResultModal } from '../../../components/ResultModal';
import { useToast } from '../../../components/Toast';
import { beginTrustedSystemUI } from '../../../lib/trustedSystemUi';
import { formatCurrencyInput, formatPercentInput, normalizeCurrencyInput } from '../../finance/utils';
import { usePreferences } from '../../preferences/hooks/usePreferences';
import {
  deleteTransactionAttachment,
  pickDocumentFile,
  pickImageFromCamera,
  pickImageFromLibrary,
  uploadTransactionAttachment,
  type LocalCaptureFile,
} from '../../transactions/services/transactionCaptureService';
import { layout, radius, spacing, typography, type AppColors, useThemeColors } from '../../../theme';
import type { AuthenticatedUserSummary } from '../../../types/auth';
import type {
  GroupBalanceRow,
  GroupMember,
  GroupSettlement,
  GroupSplitKind,
  SettlementPaymentMethod,
  SplitMode,
} from '../../../types/groups';
import { formatCurrencyBRL, formatShortDate } from '../../../utils/format';
import {
  useCloseGroupMutation,
  useConfirmSettlementMutation,
  useCreateGroupSplitMutation,
  useGroupDetails,
  useRemoveGroupMemberMutation,
  useReopenGroupMutation,
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
  { key: 'splits', label: 'Divisões' },
  { key: 'settlements', label: 'Acertos' },
  { key: 'members', label: 'Membros' },
];

const SPLIT_MODE_LABELS: Record<SplitMode, string> = {
  equal: 'Igual',
  percentage: 'Porcentagem',
  custom: 'Personalizado',
};

const PAYMENT_METHODS: Array<{ value: SettlementPaymentMethod; label: string }> = [
  { value: 'PIX', label: 'PIX' },
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'Transferencia', label: 'Transferência' },
];

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
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const { showSuccess, showError } = useToast();
  const { showResult } = useResultModal();
  const currentUserId = currentUser?.id ?? null;
  const groupDetailsQuery = useGroupDetails(currentUserId, groupId);
  const preferencesQuery = usePreferences(currentUserId);
  const createSplitMutation = useCreateGroupSplitMutation(currentUserId, groupId);
  const requestSettlementMutation = useRequestSettlementMutation(currentUserId, groupId);
  const confirmSettlementMutation = useConfirmSettlementMutation(currentUserId, groupId);
  const removeMemberMutation = useRemoveGroupMemberMutation(currentUserId, groupId);
  const closeGroupMutation = useCloseGroupMutation(currentUserId, groupId);
  const reopenGroupMutation = useReopenGroupMutation(currentUserId, groupId);

  const [codeCopied, setCodeCopied] = useState(false);
  const [isCloseDialogVisible, setIsCloseDialogVisible] = useState(false);
  const [isReopenDialogVisible, setIsReopenDialogVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<DetailsTab>('balances');
  const [isSplitModalVisible, setIsSplitModalVisible] = useState(false);
  const [isSettlementModalVisible, setIsSettlementModalVisible] = useState(false);
  const [splitTitle, setSplitTitle] = useState('');
  const [splitDescription, setSplitDescription] = useState('');
  const [splitKind, setSplitKind] = useState<GroupSplitKind>('expense');
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [splitTotal, setSplitTotal] = useState('');
  const [splitOwnerUserId, setSplitOwnerUserId] = useState(currentUserId ?? '');
  const [splitReceiptFile, setSplitReceiptFile] = useState<LocalCaptureFile | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [percentageByUserId, setPercentageByUserId] = useState<Record<string, string>>({});
  const [customAmountByUserId, setCustomAmountByUserId] = useState<Record<string, string>>({});
  const [selectedBalance, setSelectedBalance] = useState<GroupBalanceRow | null>(null);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementMethod, setSettlementMethod] = useState<SettlementPaymentMethod>('PIX');
  const [settlementNote, setSettlementNote] = useState('');
  const [settlementToConfirm, setSettlementToConfirm] = useState<GroupSettlement | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<GroupMember | null>(null);

  const groupData = groupDetailsQuery.data;
  const members = useMemo(
    () => sortMembers((groupData?.members ?? []).filter((member) => member.removedAt === null)),
    [groupData?.members],
  );
  const membersById = useMemo(() => new Map(members.map((member) => [member.userId, member])), [members]);
  const requireGroupExpenseReceipt = preferencesQuery.data?.requireGroupExpenseReceipt ?? false;

  const resetSplitForm = () => {
    setSplitTitle('');
    setSplitDescription('');
    setSplitKind('expense');
    setSplitMode('equal');
    setSplitTotal('');
    setSplitOwnerUserId(currentUserId ?? members[0]?.userId ?? '');
    setSplitReceiptFile(null);
    setSelectedMemberIds(members.map((member) => member.userId));
    setPercentageByUserId({});
    setCustomAmountByUserId({});
  };

  const resolveMemberName = (userId: string) => {
    if (userId === currentUserId) {
      return 'Você';
    }

    return membersById.get(userId)?.fullName ?? 'Membro';
  };

  const splitPreview = useMemo(() => {
    const totalAmount = normalizeCurrencyInput(splitTotal);

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
            amount: normalizeCurrencyInput(customAmountByUserId[userId] ?? ''),
          })),
        ),
        error: '',
      };
    } catch (error) {
      return {
        shares: [],
        error: error instanceof Error ? error.message : 'Não foi possível calcular a divisão.',
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

  const handleCopyCode = async () => {
    if (!groupData) {
      return;
    }

    try {
      await Clipboard.setStringAsync(groupData.group.shareCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      showError('Não foi possível copiar o código.');
    }
  };

  const handleShareCode = async () => {
    if (!groupData) {
      return;
    }

    beginTrustedSystemUI();
    try {
      await Share.share({
        message: `Entre no grupo "${groupData.group.title}" com o código ${groupData.group.shareCode}.`,
      });
    } catch {
      showError('Não foi possível compartilhar o código agora.');
    }
  };

  const handlePickSplitReceiptFromCamera = async () => {
    try {
      const file = await pickImageFromCamera();
      if (file) {
        setSplitReceiptFile(file);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível abrir a câmera.');
    }
  };

  const handlePickSplitReceiptFromLibrary = async () => {
    try {
      const file = await pickImageFromLibrary();
      if (file) {
        setSplitReceiptFile(file);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível abrir a galeria.');
    }
  };

  const handlePickSplitReceiptDocument = async () => {
    try {
      const file = await pickDocumentFile();
      if (file) {
        setSplitReceiptFile(file);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível abrir o documento.');
    }
  };

  const handleSaveSplit = async () => {
    if (!currentUserId || !groupData) {
      return;
    }

    if (!splitTitle.trim()) {
      showError('Informe um título.');
      return;
    }

    if (!splitOwnerUserId) {
      showError('Selecione quem pagou ou recebeu.');
      return;
    }

    if (splitPreview.error) {
      showError(splitPreview.error);
      return;
    }

    if (requireGroupExpenseReceipt && splitKind === 'expense' && !splitReceiptFile) {
      showError('Esta despesa em grupo exige comprovante.');
      return;
    }

    let uploadedAttachment:
      | Awaited<ReturnType<typeof uploadTransactionAttachment>>
      | null = null;

    try {
      if (splitReceiptFile) {
        uploadedAttachment = await uploadTransactionAttachment({
          file: splitReceiptFile,
          attachmentKind: 'receipt',
          sourceType: 'manual',
          groupId,
          captureMetadata: {
            splitKind,
          },
        });
      }

      await createSplitMutation.mutateAsync({
        groupId,
        title: splitTitle.trim(),
        description: splitDescription.trim(),
        kind: splitKind,
        splitMode,
        totalAmount: normalizeCurrencyInput(splitTotal),
        ownerUserId: splitOwnerUserId,
        occurredAt: new Date().toISOString(),
        attachmentId: uploadedAttachment?.id ?? null,
        shares: splitPreview.shares,
      });
      setIsSplitModalVisible(false);
      resetSplitForm();
      showSuccess('Divisão registrada.');
    } catch (error) {
      if (uploadedAttachment) {
        try {
          await deleteTransactionAttachment(uploadedAttachment);
        } catch {
          // Best-effort cleanup for orphan attachments.
        }
      }

      showError(error instanceof Error ? error.message : 'Não foi possível registrar a divisão.');
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

    const amount = normalizeCurrencyInput(settlementAmount);
    if (amount <= 0 || amount > Math.abs(selectedBalance.amount) + 0.009) {
      showError('Informe um valor válido dentro do saldo pendente.');
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
      showResult({
        variant: 'success',
        title: 'Acerto solicitado!',
        message: 'O membro vai confirmar o recebimento em breve.',
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível solicitar o acerto.');
    }
  };

  const handleConfirmSettlement = (settlement: GroupSettlement) => {
    setSettlementToConfirm(settlement);
  };

  const confirmSettlementConfirmation = async () => {
    if (!settlementToConfirm) {
      return;
    }

    try {
      await confirmSettlementMutation.mutateAsync(settlementToConfirm.id);
      setSettlementToConfirm(null);
      showResult({
        variant: 'success',
        title: 'Acerto confirmado!',
        message: 'O saldo entre vocês foi atualizado.',
      });
    } catch (error) {
      setSettlementToConfirm(null);
      showError(error instanceof Error ? error.message : 'Não foi possível confirmar o acerto.');
    }
  };

  const handleRemoveMember = (member: GroupMember) => {
    setMemberToRemove(member);
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) {
      return;
    }

    try {
      await removeMemberMutation.mutateAsync(memberToRemove.userId);
      setMemberToRemove(null);
      showSuccess('Membro removido.');
    } catch (error) {
      setMemberToRemove(null);
      showError(error instanceof Error ? error.message : 'Não foi possível remover o membro.');
    }
  };

  if (groupDetailsQuery.isLoading || !groupData) {
    return (
      <PageShell onBackPress={() => navigation.goBack()} scroll={false}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </PageShell>
    );
  }

  const pendingSettlementsCount = groupData.settlements.filter((item) => item.status === 'pending').length;
  const tabCounts: Record<DetailsTab, number | null> = {
    balances: null,
    splits: groupData.splits.length,
    settlements: pendingSettlementsCount > 0 ? pendingSettlementsCount : null,
    members: members.length,
  };
  const net = groupData.currentUserNet;
  const isClosed = groupData.group.status === 'inactive';
  const isAdmin = groupData.currentUserRole === 'admin';
  const closedByName = groupData.group.closedBy
    ? groupData.group.closedBy === currentUserId
      ? 'você'
      : (membersById.get(groupData.group.closedBy)?.fullName ?? null)
    : null;

  const handleRequestCloseGroup = () => {
    if (pendingSettlementsCount > 0) {
      showResult({
        variant: 'error',
        title: 'Não foi possível encerrar',
        message: `Existem ${pendingSettlementsCount} acerto(s) aguardando confirmação. Conclua-os antes de encerrar o grupo.`,
      });
      return;
    }

    if (groupData.summary.pending > 0.009) {
      showResult({
        variant: 'error',
        title: 'Não foi possível encerrar',
        message: `Ainda há ${formatCurrencyBRL(groupData.summary.pending)} em aberto entre os membros. Quite todos os saldos antes de encerrar o grupo.`,
      });
      return;
    }

    setIsCloseDialogVisible(true);
  };

  const confirmCloseGroup = async () => {
    try {
      await closeGroupMutation.mutateAsync();
      setIsCloseDialogVisible(false);
      showSuccess('Grupo encerrado.');
      navigation.goBack();
    } catch (error) {
      setIsCloseDialogVisible(false);
      showResult({
        variant: 'error',
        title: 'Não foi possível encerrar',
        message: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      });
    }
  };

  const confirmReopenGroup = async () => {
    try {
      await reopenGroupMutation.mutateAsync();
      setIsReopenDialogVisible(false);
      showSuccess('Grupo reativado.');
    } catch (error) {
      setIsReopenDialogVisible(false);
      showError(error instanceof Error ? error.message : 'Não foi possível reativar o grupo.');
    }
  };

  return (
    <>
      <PageShell
        onBackPress={() => navigation.goBack()}
        footer={
          isClosed ? (
            isAdmin ? (
              <Button
                label="Reativar grupo"
                variant="secondary"
                fullWidth
                loading={reopenGroupMutation.isPending}
                icon={<RotateCcw size={18} color={colors.textPrimary} />}
                onPress={() => setIsReopenDialogVisible(true)}
              />
            ) : undefined
          ) : (
            <Button
              label="Nova divisão"
              fullWidth
              icon={<Plus size={18} color={colors.white} />}
              onPress={handleOpenSplitModal}
            />
          )
        }
      >
        <PageHeader
          title={groupData.group.title}
          subtitle={groupData.group.description || 'Sem descrição.'}
          variant="primary"
          action={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Compartilhar código do grupo"
              onPress={handleShareCode}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Share2 size={20} color={colors.textPrimary} />
            </Pressable>
          }
        />

        {isClosed ? (
          <Card style={styles.closedBanner}>
            <Lock size={20} color={colors.textSecondary} />
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>Grupo encerrado</Text>
              <Text style={styles.caption}>
                {groupData.group.closedAt ? `Em ${formatShortDate(groupData.group.closedAt)}` : 'Encerrado'}
                {closedByName ? ` por ${closedByName}` : ''}
                {'. Somente consulta: não aceita novas movimentações.'}
              </Text>
            </View>
          </Card>
        ) : null}

        <Card style={styles.summaryCard}>
          <View style={styles.rowBetween}>
            <View style={styles.listCopy}>
              <Text style={styles.caption}>Seu saldo no grupo</Text>
              <Text style={[styles.balanceValue, net >= 0 ? styles.positive : styles.negative]}>
                {formatNetAmount(net)}
              </Text>
            </View>
            <Badge
              label={groupData.currentUserRole === 'admin' ? 'ADM' : 'Membro'}
              tone={groupData.currentUserRole === 'admin' ? 'primary' : 'neutral'}
            />
          </View>

          <View style={styles.metricsRow}>
            <MetricCard label="Total dividido" value={formatCurrencyBRL(groupData.summary.totalDivided)} styles={styles} />
            <MetricCard label="Acertado" value={formatCurrencyBRL(groupData.summary.settled)} valueColor={colors.success} styles={styles} />
            <MetricCard label="Pendente" value={formatCurrencyBRL(groupData.summary.pending)} valueColor={colors.danger} styles={styles} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Copiar código ${groupData.group.shareCode}`}
            onPress={handleCopyCode}
            style={({ pressed }) => [styles.codePill, pressed && styles.pressed]}
          >
            <Text style={styles.caption}>Código</Text>
            <Text style={styles.codeText} numberOfLines={1} adjustsFontSizeToFit>
              {groupData.group.shareCode}
            </Text>
            {codeCopied ? (
              <Check size={16} color={colors.success} />
            ) : (
              <Copy size={16} color={colors.textSecondary} />
            )}
          </Pressable>
        </Card>

        <View style={styles.tabsBar}>
          {TABS.map((tab) => {
            const selected = activeTab === tab.key;
            const count = tabCounts[tab.key];
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tabItem, selected && styles.tabItemSelected]}
              >
                <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]} numberOfLines={1}>
                  {tab.label}
                  {count ? ` (${count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'balances' ? (
          <>
            <Text style={styles.hintText}>
              Positivo indica crédito. Negativo indica que você deve para o membro.
            </Text>

            {groupData.balances.map((balance) => {
              const owes = balance.amount < -0.009;
              const isCredit = balance.amount > 0.009;
              return (
                <Card key={balance.userId} style={styles.itemCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{balance.fullName.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle} numberOfLines={1}>{balance.fullName}</Text>
                    <Text style={[styles.listAmount, owes ? styles.negative : isCredit ? styles.positive : styles.neutralText]}>
                      {formatNetAmount(balance.amount)}
                    </Text>
                    <Text style={styles.caption}>
                      {owes ? 'Você deve' : isCredit ? 'Deve para você' : 'Quitado'}
                    </Text>
                  </View>
                  {owes && !isClosed ? (
                    <Button label="Pagar" size="sm" onPress={() => handleOpenSettlementModal(balance)} />
                  ) : null}
                </Card>
              );
            })}

            {groupData.balances.length === 0 ? (
              <EmptyState icon={<Wallet size={28} color={colors.primary} />} text="Nenhum saldo aberto." styles={styles} />
            ) : null}
          </>
        ) : null}

        {activeTab === 'splits' ? (
          <>
            {groupData.splits.map((split) => (
              <Card key={split.id} style={styles.itemCardColumn}>
                <View style={styles.rowBetween}>
                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle} numberOfLines={1}>{split.title}</Text>
                    <Text style={styles.caption}>
                      {split.kind === 'expense' ? 'Despesa' : 'Receita'}
                      {' · '}
                      {resolveMemberName(split.ownerUserId)}
                      {' · '}
                      {formatShortDate(split.occurredAt)}
                    </Text>
                  </View>

                  <Text style={[styles.listAmount, split.kind === 'income' ? styles.positive : styles.negative]}>
                    {formatCurrencyBRL(split.totalAmount)}
                  </Text>
                </View>

                {split.description ? <Text style={styles.sectionDescription}>{split.description}</Text> : null}

                <View style={styles.badgesRow}>
                  <Badge label={`${split.shares.length} participante(s)`} tone="neutral" />
                  <Badge label={SPLIT_MODE_LABELS[split.splitMode]} tone="neutral" />
                  {split.receiptAttachmentId ? <Badge label="Comprovante" tone="primary" /> : null}
                </View>
              </Card>
            ))}

            {groupData.splits.length === 0 ? (
              <EmptyState icon={<Receipt size={28} color={colors.primary} />} text="Nenhuma divisão registrada." styles={styles} />
            ) : null}
          </>
        ) : null}

        {activeTab === 'settlements' ? (
          <>
            {groupData.settlements.map((settlement) => {
              const canConfirm = settlement.status === 'pending' && settlement.toUserId === currentUserId;
              const isOutgoing = settlement.fromUserId === currentUserId;
              const confirmed = settlement.status === 'confirmed';

              return (
                <Card key={settlement.id} style={styles.itemCardColumn}>
                  <View style={styles.rowBetween}>
                    <View style={styles.listCopy}>
                      <Text style={styles.listTitle} numberOfLines={2}>
                        {resolveMemberName(settlement.fromUserId)}
                        {' → '}
                        {resolveMemberName(settlement.toUserId)}
                      </Text>
                      <Text style={styles.caption}>
                        {settlement.paymentMethod === 'Transferencia' ? 'Transferência' : settlement.paymentMethod}
                        {' · '}
                        {formatShortDate(settlement.createdAt)}
                      </Text>
                    </View>

                    <View style={styles.amountColumn}>
                      <Text style={styles.listAmount}>{formatCurrencyBRL(settlement.amount)}</Text>
                      <Badge label={confirmed ? 'Confirmado' : 'Pendente'} tone={confirmed ? 'success' : 'warning'} />
                    </View>
                  </View>

                  {settlement.note ? <Text style={styles.sectionDescription}>{settlement.note}</Text> : null}

                  {canConfirm ? (
                    <Button
                      label="Confirmar recebimento"
                      size="sm"
                      fullWidth
                      loading={confirmSettlementMutation.isPending}
                      onPress={() => handleConfirmSettlement(settlement)}
                    />
                  ) : isOutgoing && settlement.status === 'pending' ? (
                    <Text style={styles.awaitingText}>Aguardando confirmação do recebedor.</Text>
                  ) : null}
                </Card>
              );
            })}

            {groupData.settlements.length === 0 ? (
              <EmptyState icon={<HandCoins size={28} color={colors.primary} />} text="Nenhum acerto registrado." styles={styles} />
            ) : null}
          </>
        ) : null}

        {activeTab === 'members' ? (
          <>
            {members.map((member) => {
              const canRemove =
                !isClosed &&
                isAdmin &&
                member.role !== 'admin' &&
                member.userId !== currentUserId;

              return (
                <Card key={member.userId} style={styles.itemCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{member.fullName.slice(0, 1).toUpperCase()}</Text>
                  </View>

                  <View style={styles.listCopy}>
                    <Text style={styles.listTitle} numberOfLines={1}>
                      {member.userId === currentUserId ? 'Você' : member.fullName}
                    </Text>
                    <Text style={styles.caption}>{member.role === 'admin' ? 'Administrador' : 'Membro'}</Text>
                  </View>

                  {canRemove ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remover ${member.fullName}`}
                      onPress={() => handleRemoveMember(member)}
                      style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </Pressable>
                  ) : (
                    <Badge
                      label={member.role === 'admin' ? 'ADM' : 'Ativo'}
                      tone={member.role === 'admin' ? 'primary' : 'neutral'}
                    />
                  )}
                </Card>
              );
            })}
          </>
        ) : null}

        {isAdmin && !isClosed ? (
          <Card style={styles.closeCard}>
            <Text style={styles.listTitle}>Encerrar grupo</Text>
            <Text style={styles.sectionDescription}>
              Só é possível encerrar quando não houver saldos ou acertos pendentes. O histórico fica guardado e o grupo
              deixa de aparecer na lista principal.
            </Text>
            <Button
              label="Encerrar grupo"
              variant="danger"
              fullWidth
              loading={closeGroupMutation.isPending}
              icon={<Lock size={18} color={colors.white} />}
              onPress={handleRequestCloseGroup}
            />
          </Card>
        ) : null}
      </PageShell>
      <BottomSheet
        visible={isSplitModalVisible}
        onClose={() => setIsSplitModalVisible(false)}
        title="Registrar divisão"
        subtitle="Divida uma despesa ou receita entre os membros."
        contentContainerStyle={styles.sheetContent}
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button
              label="Salvar"
              fullWidth
              loading={createSplitMutation.isPending}
              onPress={handleSaveSplit}
            />
          </>
        )}
      >
        <FieldCard>
          <FieldRow label="Título" placeholder="Ex: Mercado" value={splitTitle} onChangeText={setSplitTitle} />
          <FieldDivider />
          <FieldRow
            label="Descrição"
            placeholder="Opcional"
            value={splitDescription}
            onChangeText={setSplitDescription}
            multiline
          />
          <FieldDivider />
          <FieldRow
            label="Valor total"
            prefix="R$"
            placeholder="0,00"
            value={splitTotal}
            onChangeText={(value) => setSplitTotal(formatCurrencyInput(value))}
            keyboardType="decimal-pad"
          />
        </FieldCard>

        <Text style={styles.fieldLabel}>Tipo</Text>
        <View style={styles.wrapRow}>
          {(['expense', 'income'] as GroupSplitKind[]).map((kind) => (
            <Chip
              key={kind}
              label={kind === 'expense' ? 'Despesa' : 'Receita'}
              selected={splitKind === kind}
              onPress={() => setSplitKind(kind)}
            />
          ))}
        </View>

        <Text style={styles.fieldLabel}>{splitKind === 'expense' ? 'Quem pagou?' : 'Quem recebeu?'}</Text>
        <View style={styles.wrapRow}>
          {members.map((member) => (
            <Chip
              key={member.userId}
              label={resolveMemberName(member.userId)}
              selected={splitOwnerUserId === member.userId}
              onPress={() => setSplitOwnerUserId(member.userId)}
            />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Modo de divisão</Text>
        <View style={styles.wrapRow}>
          <Chip label="Igual" selected={splitMode === 'equal'} onPress={() => setSplitMode('equal')} />
          <Chip label="Por porcentagem" selected={splitMode === 'percentage'} onPress={() => setSplitMode('percentage')} />
          <Chip label="Personalizado" selected={splitMode === 'custom'} onPress={() => setSplitMode('custom')} />
        </View>

        <Text style={styles.fieldLabel}>Participantes</Text>
        <View style={styles.wrapRow}>
          {members.map((member) => (
            <Chip
              key={member.userId}
              label={resolveMemberName(member.userId)}
              selected={selectedMemberIds.includes(member.userId)}
              onPress={() => toggleMember(member.userId)}
            />
          ))}
        </View>

        <Text style={styles.fieldLabel}>Comprovante</Text>
        <Text style={styles.receiptHelper}>
          {requireGroupExpenseReceipt && splitKind === 'expense'
            ? 'Obrigatório para despesas neste usuário.'
            : 'Opcional. Anexe uma NF ou notinha para comprovar a despesa.'}
        </Text>
        <View style={styles.wrapRow}>
          <Chip
            label="Camera"
            icon={<Camera size={16} color={colors.textSecondary} />}
            onPress={handlePickSplitReceiptFromCamera}
          />
          <Chip
            label="Galeria"
            icon={<ImageIcon size={16} color={colors.textSecondary} />}
            onPress={handlePickSplitReceiptFromLibrary}
          />
          <Chip
            label="PDF"
            icon={<FileText size={16} color={colors.textSecondary} />}
            onPress={handlePickSplitReceiptDocument}
          />
        </View>
        {splitReceiptFile ? (
          <View style={styles.receiptCard}>
            <View style={styles.listCopy}>
              <Text style={styles.listTitle}>Arquivo selecionado</Text>
              <Text style={styles.sectionDescription}>{splitReceiptFile.name}</Text>
            </View>
            <Pressable onPress={() => setSplitReceiptFile(null)} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
              <X size={16} color={colors.danger} />
            </Pressable>
          </View>
        ) : null}

        {splitMode !== 'equal' ? (
          <FieldCard>
            {selectedMemberIds.map((userId, index) => (
              <View key={userId}>
                {index > 0 ? <FieldDivider /> : null}
                <FieldRow
                  label={resolveMemberName(userId)}
                  prefix={splitMode === 'percentage' ? undefined : 'R$'}
                  placeholder={splitMode === 'percentage' ? '%' : '0,00'}
                  value={
                    splitMode === 'percentage'
                      ? percentageByUserId[userId] ?? ''
                      : customAmountByUserId[userId] ?? ''
                  }
                  onChangeText={(value) =>
                    splitMode === 'percentage'
                      ? setPercentageByUserId((current) => ({ ...current, [userId]: formatPercentInput(value) }))
                      : setCustomAmountByUserId((current) => ({ ...current, [userId]: formatCurrencyInput(value) }))
                  }
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
          </FieldCard>
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
      </BottomSheet>

      <BottomSheet
        visible={isSettlementModalVisible}
        onClose={() => setIsSettlementModalVisible(false)}
        title="Registrar pagamento"
        subtitle={selectedBalance ? `Acerto com ${selectedBalance.fullName}` : 'Acerto'}
        contentContainerStyle={styles.sheetContent}
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button
              label="Solicitar acerto"
              fullWidth
              loading={requestSettlementMutation.isPending}
              onPress={handleRequestSettlement}
            />
          </>
        )}
      >
        <FieldCard>
          <FieldRow
            label="Valor"
            prefix="R$"
            placeholder="0,00"
            value={settlementAmount}
            onChangeText={(value) => setSettlementAmount(formatCurrencyInput(value))}
            keyboardType="decimal-pad"
          />
          <FieldDivider />
          <FieldRow
            label="Observação"
            placeholder="Opcional"
            value={settlementNote}
            onChangeText={setSettlementNote}
            multiline
          />
        </FieldCard>

        <Text style={styles.fieldLabel}>Forma de pagamento</Text>
        <View style={styles.wrapRow}>
          {PAYMENT_METHODS.map((method) => (
            <Chip
              key={method.value}
              label={method.label}
              selected={settlementMethod === method.value}
              onPress={() => setSettlementMethod(method.value)}
            />
          ))}
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={settlementToConfirm !== null}
        title="Confirmar acerto"
        message={
          settlementToConfirm
            ? `Confirmar o recebimento de ${formatCurrencyBRL(settlementToConfirm.amount)}?`
            : ''
        }
        confirmLabel="Confirmar"
        destructive={false}
        loading={confirmSettlementMutation.isPending}
        onConfirm={confirmSettlementConfirmation}
        onCancel={() => setSettlementToConfirm(null)}
      />

      <ConfirmDialog
        visible={isCloseDialogVisible}
        title="Encerrar grupo"
        message="O grupo será desativado, deixará de aparecer na lista principal e não poderá receber novas movimentações enquanto estiver inativo. O histórico continuará disponível para consulta."
        confirmLabel="Encerrar"
        destructive
        loading={closeGroupMutation.isPending}
        onConfirm={confirmCloseGroup}
        onCancel={() => setIsCloseDialogVisible(false)}
      />

      <ConfirmDialog
        visible={isReopenDialogVisible}
        title="Reativar grupo"
        message="O grupo voltará para a lista principal e poderá receber novas movimentações. O histórico anterior será mantido."
        confirmLabel="Reativar"
        destructive={false}
        loading={reopenGroupMutation.isPending}
        onConfirm={confirmReopenGroup}
        onCancel={() => setIsReopenDialogVisible(false)}
      />

      <ConfirmDialog
        visible={memberToRemove !== null}
        title="Remover membro"
        message={memberToRemove ? `Deseja remover ${memberToRemove.fullName} do grupo?` : ''}
        confirmLabel="Remover"
        destructive
        loading={removeMemberMutation.isPending}
        onConfirm={confirmRemoveMember}
        onCancel={() => setMemberToRemove(null)}
      />
    </>
  );
}

function EmptyState({
  icon,
  text,
  styles,
}: {
  icon: ReactNode;
  text: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Card style={styles.emptyCard}>
      {icon}
      <Text style={styles.emptyText}>{text}</Text>
    </Card>
  );
}

function MetricCard({
  label,
  value,
  valueColor,
  styles,
}: {
  label: string;
  value: string;
  valueColor?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  positive: { color: colors.success },
  negative: { color: colors.danger },
  neutralText: { color: colors.textSecondary },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  caption: { ...typography.caption, color: colors.textSecondary },
  summaryCard: { gap: spacing.md },
  closedBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.mutedSurface },
  closeCard: { gap: spacing.md },
  balanceValue: { ...typography.value, fontWeight: '700' },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, backgroundColor: colors.mutedSurface, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  metricLabel: { ...typography.caption, color: colors.textSecondary },
  metricValue: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  codePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  codeText: { ...typography.body, flexShrink: 1, color: colors.textPrimary, fontWeight: '700', letterSpacing: 1 },
  tabsBar: { flexDirection: 'row', backgroundColor: colors.mutedSurface, borderRadius: radius.md, padding: 4, gap: 4 },
  tabItem: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: 2 },
  tabItemSelected: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  tabLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  tabLabelSelected: { color: colors.primary, fontWeight: '700' },
  hintText: { ...typography.caption, color: colors.textSecondary },
  itemCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  itemCardColumn: { gap: spacing.sm },
  avatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.body, color: colors.primary, fontWeight: '700' },
  listCopy: { flex: 1, gap: spacing.xs },
  listTitle: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  listAmount: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  amountColumn: { alignItems: 'flex-end', gap: spacing.xs },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  sectionTitle: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  sectionDescription: { ...typography.body, color: colors.textSecondary },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  awaitingText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  removeButton: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },  sheetContent: { gap: spacing.md, paddingBottom: spacing.lg },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  previewCard: { gap: spacing.sm, backgroundColor: colors.mutedSurface },
  errorText: { ...typography.body, color: colors.danger },
  receiptHelper: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },
  receiptCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surface },
});
