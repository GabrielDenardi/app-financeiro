import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, Camera, FileText, Image as ImageIcon, Plus, Share2, Trash2, X } from 'lucide-react-native';

import { Badge } from '../../../components/Badge';
import { BottomSheet } from '../../../components/BottomSheet';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { Chip } from '../../../components/Chip';
import { FieldCard, FieldDivider, FieldRow } from '../../../components/FormField';
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

const PAYMENT_METHODS: Array<{ value: SettlementPaymentMethod; label: string }> = [
  { value: 'PIX', label: 'PIX' },
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'Transferencia', label: 'Transferencia' },
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
  const currentUserId = currentUser?.id ?? null;
  const groupDetailsQuery = useGroupDetails(currentUserId, groupId);
  const preferencesQuery = usePreferences(currentUserId);
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
  const [splitReceiptFile, setSplitReceiptFile] = useState<LocalCaptureFile | null>(null);
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
    } catch {
      Alert.alert('Compartilhamento', 'Nao foi possivel compartilhar o codigo agora.');
    }
  };

  const handlePickSplitReceiptFromCamera = async () => {
    try {
      const file = await pickImageFromCamera();
      if (file) {
        setSplitReceiptFile(file);
      }
    } catch (error) {
      Alert.alert('Comprovante', error instanceof Error ? error.message : 'Nao foi possivel abrir a camera.');
    }
  };

  const handlePickSplitReceiptFromLibrary = async () => {
    try {
      const file = await pickImageFromLibrary();
      if (file) {
        setSplitReceiptFile(file);
      }
    } catch (error) {
      Alert.alert('Comprovante', error instanceof Error ? error.message : 'Nao foi possivel abrir a galeria.');
    }
  };

  const handlePickSplitReceiptDocument = async () => {
    try {
      const file = await pickDocumentFile();
      if (file) {
        setSplitReceiptFile(file);
      }
    } catch (error) {
      Alert.alert('Comprovante', error instanceof Error ? error.message : 'Nao foi possivel abrir o documento.');
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

    if (requireGroupExpenseReceipt && splitKind === 'expense' && !splitReceiptFile) {
      Alert.alert('Divisao', 'Esta despesa em grupo exige comprovante.');
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
        totalAmount: parseDecimal(splitTotal),
        ownerUserId: splitOwnerUserId,
        occurredAt: new Date().toISOString(),
        attachmentId: uploadedAttachment?.id ?? null,
        shares: splitPreview.shares,
      });
      setIsSplitModalVisible(false);
      resetSplitForm();
    } catch (error) {
      if (uploadedAttachment) {
        try {
          await deleteTransactionAttachment(uploadedAttachment);
        } catch {
          // Best-effort cleanup for orphan attachments.
        }
      }

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
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{groupData.group.title}</Text>
          <Text style={styles.headerSubtitle}>{groupData.group.description || 'Sem descricao.'}</Text>
        </View>

        <Pressable onPress={handleShareCode} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <Share2 size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.heroCard}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.heroMuted}>Codigo</Text>
              <Text style={styles.heroCode}>{groupData.group.shareCode}</Text>
            </View>

            <Button
              label="Nova divisao"
              size="sm"
              icon={<Plus size={16} color={colors.white} />}
              onPress={handleOpenSplitModal}
            />
          </View>

          <View style={styles.metricsRow}>
            <MetricCard label="Total dividido" value={formatCurrencyBRL(groupData.summary.totalDivided)} styles={styles} />
            <MetricCard label="Acertado" value={formatCurrencyBRL(groupData.summary.settled)} valueColor={colors.success} styles={styles} />
            <MetricCard label="Pendente" value={formatCurrencyBRL(groupData.summary.pending)} valueColor={colors.danger} styles={styles} />
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
            <Chip
              key={tab.key}
              label={tab.label}
              selected={activeTab === tab.key}
              onPress={() => setActiveTab(tab.key)}
            />
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
                  <Button label="Pagar" size="sm" onPress={() => handleOpenSettlementModal(balance)} />
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
                {split.receiptAttachmentId ? (
                  <Badge label="Comprovante anexado" tone="primary" />
                ) : null}
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
                    <Button
                      label="Confirmar recebimento"
                      size="sm"
                      loading={confirmSettlementMutation.isPending}
                      onPress={() => handleConfirmSettlement(settlement)}
                    />
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
      </ScrollView>

      <BottomSheet
        visible={isSplitModalVisible}
        onClose={() => setIsSplitModalVisible(false)}
        title="Registrar divisao"
        subtitle="Divida uma despesa ou receita entre os membros."
        contentContainerStyle={styles.sheetContent}
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button
              label="Salvar divisao"
              fullWidth
              loading={createSplitMutation.isPending}
              onPress={handleSaveSplit}
            />
          </>
        )}
      >
        <FieldCard>
          <FieldRow label="Titulo" placeholder="Ex: Mercado" value={splitTitle} onChangeText={setSplitTitle} />
          <FieldDivider />
          <FieldRow
            label="Descricao"
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
            onChangeText={setSplitTotal}
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

        <Text style={styles.fieldLabel}>Modo de divisao</Text>
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
            ? 'Obrigatorio para despesas neste usuario.'
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
                      ? setPercentageByUserId((current) => ({ ...current, [userId]: value }))
                      : setCustomAmountByUserId((current) => ({ ...current, [userId]: value }))
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
            onChangeText={setSettlementAmount}
            keyboardType="decimal-pad"
          />
          <FieldDivider />
          <FieldRow
            label="Observacao"
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
    </SafeAreaView>
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
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: layout.pageHorizontal, paddingTop: layout.pageHeaderTop, paddingBottom: spacing.md },
  headerCopy: { flex: 1, gap: spacing.xs },
  headerTitle: { ...typography.h1, color: colors.textPrimary },
  headerSubtitle: { ...typography.body, color: colors.textSecondary },
  iconButton: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  scrollContent: { padding: layout.pageHorizontal, gap: layout.pageSectionGap, paddingBottom: spacing.xxl },
  heroCard: { backgroundColor: colors.primary, borderColor: colors.primary, gap: spacing.md },
  heroMuted: { ...typography.caption, color: colors.whiteAlpha80 },
  heroCode: { ...typography.h2, color: colors.white, letterSpacing: 1 },
  heroBalance: { ...typography.value, fontWeight: '700' },
  positive: { color: colors.success },
  negative: { color: colors.danger },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  metricsRow: { flexDirection: 'row', gap: spacing.sm },
  metricCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  metricLabel: { ...typography.caption, color: colors.textSecondary },
  metricValue: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  tabsRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  sectionCard: { gap: spacing.sm },
  sectionTitle: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  sectionDescription: { ...typography.body, color: colors.textSecondary },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  listCopy: { flex: 1, gap: spacing.xs },
  listTitle: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  listAmount: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  emptyText: { ...typography.body, color: colors.textSecondary },
  awaitingText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  memberAvatar: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { ...typography.body, color: colors.primary, fontWeight: '700' },
  removeButton: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  sheetContent: { gap: spacing.md, paddingBottom: spacing.lg },
  fieldLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  previewCard: { gap: spacing.sm, backgroundColor: colors.mutedSurface },
  errorText: { ...typography.body, color: colors.danger },
  receiptHelper: { ...typography.caption, color: colors.textSecondary, lineHeight: 17 },
  receiptCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surface },
});
