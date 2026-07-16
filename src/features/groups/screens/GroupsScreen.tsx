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
import { ArrowLeft, Copy, KeyRound, Plus, Users } from 'lucide-react-native';

import { Badge } from '../../../components/Badge';
import { BottomSheet } from '../../../components/BottomSheet';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { FieldCard, FieldDivider, FieldRow } from '../../../components/FormField';
import { layout, radius, spacing, typography, type AppColors, useThemeColors } from '../../../theme';
import type { AuthenticatedUserSummary } from '../../../types/auth';
import { formatCurrencyBRL } from '../../../utils/format';
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
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [isPaywallVisible, setIsPaywallVisible] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');

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
      Alert.alert('Grupo', 'Informe um nome para o grupo.');
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
      navigation.navigate('GroupDetails', { groupId: newGroupId });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível criar o grupo.');
    }
  };

  const handleJoinGroup = async () => {
    if (!/^[A-F0-9]{16}$/.test(joinCode.trim().toUpperCase())) {
      Alert.alert('Grupo', 'Informe um código válido com 16 caracteres.');
      return;
    }

    try {
      const targetGroupId = await joinGroupMutation.mutateAsync(joinCode);
      setJoinCode('');
      setIsJoinModalVisible(false);
      navigation.navigate('GroupDetails', { groupId: targetGroupId });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Não foi possível entrar no grupo.');
    }
  };

  const handleShareCode = async (title: string, shareCode: string) => {
    try {
      await Share.share({
        message: `Entre no grupo "${title}" com o código ${shareCode}.`,
      });
    } catch (error) {
      Alert.alert('Compartilhamento', 'Não foi possível abrir o compartilhamento agora.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Grupos</Text>
          <Text style={styles.headerSubtitle}>Compartilhe despesas, receitas e acertos.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroTitle}>Controle financeiro em conjunto</Text>
          <Text style={styles.heroDescription}>
            Crie grupos, acompanhe saldos e confirme pagamentos entre os membros sem perder o histórico.
          </Text>

          <View style={styles.heroActions}>
            <Button
              label="Criar grupo"
              size="md"
              icon={<Plus size={18} color={colors.white} />}
              onPress={openCreateModal}
            />
            <Button
              label="Entrar por código"
              variant="secondary"
              size="md"
              icon={<KeyRound size={18} color={colors.textPrimary} />}
              onPress={() => setIsJoinModalVisible(true)}
            />
          </View>
        </Card>

        {groupsQuery.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {!groupsQuery.isLoading && groupsQuery.data?.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Users size={28} color={colors.primary} />
            <Text style={styles.emptyTitle}>Nenhum grupo ainda</Text>
            <Text style={styles.emptyDescription}>
              Crie seu primeiro grupo ou use um código para entrar em um grupo existente.
            </Text>
          </Card>
        ) : null}

        {(groupsQuery.data ?? []).map((item) => (
          <Card key={item.group.id} style={styles.groupCard}>
            <View style={styles.groupCardHeader}>
              <View style={styles.groupIdentity}>
                <View style={styles.groupIcon}>
                  <Text style={styles.groupIconText}>{item.group.title.slice(0, 1).toUpperCase()}</Text>
                </View>

                <View style={styles.groupHeaderCopy}>
                  <Text style={styles.groupTitle}>{item.group.title}</Text>
                  <Text style={styles.groupDescription} numberOfLines={2}>
                    {item.group.description || 'Sem descrição.'}
                  </Text>
                </View>
              </View>

              <Badge
                label={item.currentUserRole === 'admin' ? 'ADM' : 'Membro'}
                tone={item.currentUserRole === 'admin' ? 'primary' : 'neutral'}
              />
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Receita/Despesa</Text>
                <Text style={styles.summaryValue}>{formatCurrencyBRL(item.summary.totalDivided)}</Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Acertado</Text>
                <Text style={[styles.summaryValue, { color: colors.success }]}>
                  {formatCurrencyBRL(item.summary.settled)}
                </Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLabel}>Pendente</Text>
                <Text style={[styles.summaryValue, { color: colors.danger }]}>
                  {formatCurrencyBRL(item.summary.pending)}
                </Text>
              </View>
            </View>

            <View style={styles.groupMetaRow}>
              <Text style={styles.groupMetaText}>
                {item.members.length} membro(s) ativos
              </Text>
              <Text
                style={[
                  styles.groupNetText,
                  item.currentUserNet >= 0 ? styles.groupNetPositive : styles.groupNetNegative,
                ]}
              >
                Seu saldo: {formatSignedAmount(item.currentUserNet)}
              </Text>
            </View>

            <View style={styles.codeRow}>
              <View style={styles.codePill}>
                <Copy size={14} color={colors.textSecondary} />
                <Text style={styles.codeText}>{item.group.shareCode}</Text>
              </View>

              <Button
                label="Compartilhar código"
                variant="ghost"
                size="sm"
                onPress={() => handleShareCode(item.group.title, item.group.shareCode)}
              />
            </View>

            <Button
              label="Ver detalhes"
              size="md"
              onPress={() => navigation.navigate('GroupDetails', { groupId: item.group.id })}
            />
          </Card>
        ))}
      </ScrollView>

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
              label="Criar grupo"
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
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.pageHorizontal,
    paddingTop: layout.pageHeaderTop,
    paddingBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.85,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  scrollContent: {
    padding: layout.pageHorizontal,
    gap: layout.pageSectionGap,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    gap: spacing.md,
  },
  heroTitle: {
    ...typography.h2,
    color: colors.white,
  },
  heroDescription: {
    ...typography.body,
    color: colors.whiteAlpha80,
  },
  heroActions: {
    gap: spacing.sm,
  },
  loadingWrap: {
    paddingVertical: spacing.xxl,
  },
  emptyCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  emptyDescription: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  groupCard: {
    gap: spacing.md,
  },
  groupCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  groupIdentity: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIconText: {
    ...typography.h2,
    color: colors.primary,
  },
  groupHeaderCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  groupTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  groupDescription: {
    ...typography.body,
    color: colors.textSecondary,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: colors.mutedSurface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  groupMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  groupMetaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  groupNetText: {
    ...typography.caption,
    fontWeight: '700',
  },
  groupNetPositive: {
    color: colors.success,
  },
  groupNetNegative: {
    color: colors.danger,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  codeText: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sheetContent: {
    paddingBottom: spacing.lg,
  },
});
