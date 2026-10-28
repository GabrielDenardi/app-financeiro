import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowRight, Check, ChevronRight, Copy, KeyRound, Plus, Share2, Users } from 'lucide-react-native';

import { Badge } from '../../../components/Badge';
import { BottomSheet } from '../../../components/BottomSheet';
import { Button } from '../../../components/Button';
import { PageHeader } from '../../../components/PageHeader';
import { PageShell } from '../../../components/PageShell';
import { Card } from '../../../components/Card';
import { FieldCard, FieldDivider, FieldRow } from '../../../components/FormField';
import { useToast } from '../../../components/Toast';
import { beginTrustedSystemUI } from '../../../lib/trustedSystemUi';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../../../theme';
import type { AuthenticatedUserSummary } from '../../../types/auth';
import { formatCurrencyBRL, formatShortDate } from '../../../utils/format';
import { UpgradePaywallSheet } from '../../plans/components/UpgradePaywallSheet';
import { useCurrentPlan } from '../../plans/hooks';
import { useCreateGroupMutation, useGroups, useJoinGroupMutation } from '../hooks/useGroups';

type GroupsScreenProps = {
  currentUser: AuthenticatedUserSummary | null;
};

function formatSignedAmount(value: number) {
  if (value > 0) {
    return `+ ${formatCurrencyBRL(value)}`;
  }

  if (value < 0) {
    return `- ${formatCurrencyBRL(Math.abs(value))}`;
  }

  return formatCurrencyBRL(0);
}

export function GroupsScreen({ currentUser }: GroupsScreenProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const { showSuccess, showError } = useToast();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [copiedGroupId, setCopiedGroupId] = useState<string | null>(null);

  const groupsQuery = useGroups(currentUser?.id);
  const createGroupMutation = useCreateGroupMutation(currentUser?.id);
  const joinGroupMutation = useJoinGroupMutation(currentUser?.id);
  const currentPlan = useCurrentPlan(currentUser?.id);

  const openCreateModal = () => {
    if (!currentPlan.entitlements.createGroups) {
      setIsPaywallVisible(true);
      return;
    }

    setIsCreateModalVisible(true);
  };

  const handleCreateGroup = async () => {
    if (!groupTitle.trim()) {
      showError('Informe um nome para o grupo.');
      return;
    }

    try {
      const newGroupId = await createGroupMutation.mutateAsync({
        title: groupTitle,
        description: groupDescription,
      });
      setGroupTitle('');
      setGroupDescription('');
      setIsCreateModalVisible(false);
      showSuccess('Grupo criado.');
      navigation.navigate('GroupDetails', { groupId: newGroupId });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível criar o grupo.');
    }
  };

  const handleJoinGroup = async () => {
    if (!/^[A-F0-9]{16}$/.test(joinCode.trim().toUpperCase())) {
      showError('Informe um código válido com 16 caracteres.');
      return;
    }

    try {
      const targetGroupId = await joinGroupMutation.mutateAsync(joinCode);
      setJoinCode('');
      setIsJoinModalVisible(false);
      showSuccess('Você entrou no grupo.');
      navigation.navigate('GroupDetails', { groupId: targetGroupId });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Não foi possível entrar no grupo.');
    }
  };

  const handleCopyCode = async (groupId: string, shareCode: string) => {
    try {
      await Clipboard.setStringAsync(shareCode);
      setCopiedGroupId(groupId);
      setTimeout(() => setCopiedGroupId((current) => (current === groupId ? null : current)), 2000);
    } catch {
      showError('Não foi possível copiar o código.');
    }
  };

  const handleShareCode = async (title: string, shareCode: string) => {
    beginTrustedSystemUI();
    try {
      await Share.share({
        message: `Entre no grupo "${title}" com o código ${shareCode}.`,
      });
    } catch {
      showError('Não foi possível abrir o compartilhamento agora.');
    }
  };

  const allGroups = groupsQuery.data ?? [];
  const activeGroups = allGroups.filter((item) => item.group.status !== 'inactive');
  const closedGroups = allGroups.filter((item) => item.group.status === 'inactive');
  const viewingClosed = showClosed && closedGroups.length > 0;
  const groups = viewingClosed ? closedGroups : activeGroups;
  const totalNet = activeGroups.reduce((sum, item) => sum + item.currentUserNet, 0);
  const totalPending = activeGroups.reduce((sum, item) => sum + item.summary.pending, 0);

  return (
    <>
      <PageShell onBackPress={() => navigation.goBack()}>
        <PageHeader
          title="Grupos"
          subtitle={activeGroups.length > 0 ? `${activeGroups.length} grupo(s) ativo(s)` : 'Compartilhe despesas, receitas e acertos.'}
          variant="primary"
        />

        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            onPress={openCreateModal}
            style={({ pressed }) => [styles.actionTile, styles.actionTilePrimary, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, styles.actionIconPrimary]}>
              <Plus size={20} color={colors.white} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.white }]}>Criar grupo</Text>
            <Text style={[styles.actionHint, { color: colors.whiteAlpha80 }]}>Comece uma nova divisão</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setIsJoinModalVisible(true)}
            style={({ pressed }) => [styles.actionTile, pressed && styles.pressed]}
          >
            <View style={styles.actionIcon}>
              <KeyRound size={20} color={colors.primary} />
            </View>
            <Text style={styles.actionTitle}>Entrar por código</Text>
            <Text style={styles.actionHint}>Use o código de um amigo</Text>
          </Pressable>
        </View>

        {!viewingClosed && activeGroups.length > 0 ? (
          <View style={styles.overview}>
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Seu saldo geral</Text>
              <Text style={[styles.overviewValue, totalNet >= 0 ? styles.positive : styles.negative]}>
                {formatSignedAmount(totalNet)}
              </Text>
            </View>
            <View style={styles.overviewDivider} />
            <View style={styles.overviewItem}>
              <Text style={styles.overviewLabel}>Pendente nos grupos</Text>
              <Text style={styles.overviewValue}>{formatCurrencyBRL(totalPending)}</Text>
            </View>
          </View>
        ) : null}

        {groupsQuery.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {closedGroups.length > 0 ? (
          <View style={styles.tabsBar}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: !viewingClosed }}
              onPress={() => setShowClosed(false)}
              style={[styles.tabItem, !viewingClosed && styles.tabItemSelected]}
            >
              <Text style={[styles.tabLabel, !viewingClosed && styles.tabLabelSelected]}>
                Ativos ({activeGroups.length})
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: viewingClosed }}
              onPress={() => setShowClosed(true)}
              style={[styles.tabItem, viewingClosed && styles.tabItemSelected]}
            >
              <Text style={[styles.tabLabel, viewingClosed && styles.tabLabelSelected]}>
                Encerrados ({closedGroups.length})
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!groupsQuery.isLoading && groups.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Users size={28} color={colors.primary} />
            <Text style={styles.emptyTitle}>Nenhum grupo ativo</Text>
            <Text style={styles.emptyDescription}>
              Crie um grupo ou use um código para entrar em um grupo existente.
            </Text>
          </Card>
        ) : null}

        {groups.length > 0 ? (
          <Text style={styles.sectionLabel}>{viewingClosed ? 'Grupos encerrados' : 'Seus grupos'}</Text>
        ) : null}

        {groups.map((item) => {
          const net = item.currentUserNet;
          const isClosed = item.group.status === 'inactive';
          const accent = isClosed ? colors.border : net > 0.009 ? colors.success : net < -0.009 ? colors.danger : colors.border;

          return (
            <Pressable
              key={item.group.id}
              accessibilityRole="button"
              accessibilityLabel={`Abrir grupo ${item.group.title}`}
              onPress={() => navigation.navigate('GroupDetails', { groupId: item.group.id })}
              style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}
            >
              <View style={[styles.accentBar, { backgroundColor: accent }]} />

              <View style={styles.groupBody}>
                <View style={styles.groupTop}>
                  <View style={styles.groupIcon}>
                    <Text style={styles.groupIconText}>{item.group.title.slice(0, 1).toUpperCase()}</Text>
                  </View>

                  <View style={styles.groupHeaderCopy}>
                    <View style={styles.titleRow}>
                      <Text style={styles.groupTitle} numberOfLines={1}>{item.group.title}</Text>
                      {isClosed ? <Badge label="Encerrado" tone="neutral" /> : null}
                      {item.currentUserRole === 'admin' ? <Badge label="ADM" tone="primary" /> : null}
                    </View>
                    <Text style={styles.groupDescription} numberOfLines={1}>
                      {isClosed && item.group.closedAt
                        ? `Encerrado em ${formatShortDate(item.group.closedAt)}`
                        : item.group.description || `${item.members.length} membro(s) ativos`}
                    </Text>
                  </View>

                  <ChevronRight size={20} color={colors.textSecondary} />
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Seu saldo</Text>
                    <Text style={[styles.statValue, net >= 0 ? styles.positive : styles.negative]}>
                      {formatSignedAmount(net)}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Pendente</Text>
                    <Text style={styles.statValue}>{formatCurrencyBRL(item.summary.pending)}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Membros</Text>
                    <Text style={styles.statValue}>{item.members.length}</Text>
                  </View>
                </View>

                {!isClosed ? (
                <View style={styles.codeRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Copiar código ${item.group.shareCode}`}
                    hitSlop={8}
                    onPress={() => handleCopyCode(item.group.id, item.group.shareCode)}
                    style={({ pressed }) => [styles.codePill, pressed && styles.pressed]}
                  >
                    {copiedGroupId === item.group.id ? (
                      <Check size={14} color={colors.success} />
                    ) : (
                      <Copy size={14} color={colors.textSecondary} />
                    )}
                    <Text style={styles.codeText} numberOfLines={1}>{item.group.shareCode}</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Compartilhar código"
                    hitSlop={8}
                    onPress={() => handleShareCode(item.group.title, item.group.shareCode)}
                    style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}
                  >
                    <Share2 size={16} color={colors.primary} />
                    <Text style={styles.shareText}>Compartilhar</Text>
                  </Pressable>
                </View>
                ) : null}

                <View style={styles.detailsCta}>
                  <Text style={styles.detailsCtaText}>{isClosed ? 'Consultar histórico' : 'Ver detalhes do grupo'}</Text>
                  <ArrowRight size={16} color={colors.primary} />
                </View>
              </View>
            </Pressable>
          );
        })}
      </PageShell>
      <BottomSheet
        visible={isCreateModalVisible}
        onClose={() => setIsCreateModalVisible(false)}
        title="Criar grupo"
        subtitle="Defina o nome e a descrição do grupo."
        contentContainerStyle={styles.sheetContent}
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button
              label="Criar"
              fullWidth
              loading={createGroupMutation.isPending}
              onPress={handleCreateGroup}
            />
          </>
        )}
      >
        <FieldCard>
          <FieldRow
            label="Nome"
            placeholder="Nome do grupo"
            value={groupTitle}
            onChangeText={setGroupTitle}
          />
          <FieldDivider />
          <FieldRow
            label="Descrição"
            placeholder="Opcional"
            value={groupDescription}
            onChangeText={setGroupDescription}
            multiline
          />
        </FieldCard>
      </BottomSheet>

      <BottomSheet
        visible={isJoinModalVisible}
        onClose={() => setIsJoinModalVisible(false)}
        title="Entrar em grupo"
        subtitle="Cole ou digite o código de compartilhamento."
        contentContainerStyle={styles.sheetContent}
        footer={(close) => (
          <>
            <Button label="Cancelar" variant="secondary" fullWidth onPress={close} />
            <Button
              label="Entrar"
              fullWidth
              loading={joinGroupMutation.isPending}
              onPress={handleJoinGroup}
            />
          </>
        )}
      >
        <FieldCard>
          <FieldRow
            label="Código"
            placeholder="Ex: A1B2C3D4E5F60718"
            value={joinCode}
            onChangeText={(value) => setJoinCode(value.toUpperCase().replace(/[^A-F0-9]/g, '').slice(0, 16))}
            autoCapitalize="characters"
          />
        </FieldCard>
      </BottomSheet>

      <UpgradePaywallSheet
        visible={isPaywallVisible}
        onClose={() => setIsPaywallVisible(false)}
        featureTitle="Criar grupos"
        description="Crie grupos para dividir despesas com amigos e familia — disponivel a partir do Plano Intermediario."
      />
    </>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  pressed: { opacity: 0.85 },
  positive: { color: colors.success },
  negative: { color: colors.danger },
  actionsRow: { flexDirection: 'row', gap: spacing.md },
  actionTile: { flex: 1, gap: spacing.xs, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  actionTilePrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  actionIcon: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, marginBottom: spacing.xs },
  actionIconPrimary: { backgroundColor: colors.primaryLight },
  actionTitle: { ...typography.h3, color: colors.textPrimary, fontWeight: '700' },
  actionHint: { ...typography.caption, color: colors.textSecondary },
  overview: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  overviewItem: { flex: 1, gap: spacing.xs },
  overviewDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginHorizontal: spacing.md },
  overviewLabel: { ...typography.caption, color: colors.textSecondary },
  overviewValue: { ...typography.h2, color: colors.textPrimary, fontWeight: '700' },
  sectionLabel: { ...typography.h3, color: colors.textSecondary, fontWeight: '700' },
  loadingWrap: { paddingVertical: spacing.xxl },
  emptyCard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyTitle: { ...typography.h2, color: colors.textPrimary },
  emptyDescription: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  groupRow: { flexDirection: 'row', overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  accentBar: { width: 6 },
  groupBody: { flex: 1, padding: spacing.lg, gap: spacing.md },
  groupTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  groupIcon: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  groupIconText: { ...typography.h2, color: colors.primary },
  groupHeaderCopy: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupTitle: { ...typography.h2, flexShrink: 1, color: colors.textPrimary },
  groupDescription: { ...typography.caption, color: colors.textSecondary },
  statsRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  statItem: { flex: 1, gap: 2 },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  statValue: { ...typography.body, color: colors.textPrimary, fontWeight: '700' },
  codeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  codePill: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, minWidth: 0, gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.mutedSurface },
  codeText: { ...typography.caption, color: colors.textPrimary, fontWeight: '700', letterSpacing: 1 },
  detailsCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  detailsCtaText: { ...typography.body, color: colors.primary, fontWeight: '700' },
  tabsBar: { flexDirection: 'row', backgroundColor: colors.mutedSurface, borderRadius: radius.md, padding: 4, gap: 4 },
  tabItem: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  tabItemSelected: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  tabLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: '600' },
  tabLabelSelected: { color: colors.primary, fontWeight: '700' },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  shareText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  sheetContent: { paddingBottom: spacing.lg },
});