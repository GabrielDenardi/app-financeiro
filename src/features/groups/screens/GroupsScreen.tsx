import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
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
import { formatCurrencyBRL } from '../../../utils/format';
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
  const navigation = useNavigation<any>();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const groupsQuery = useGroups(currentUser?.id);
  const createGroupMutation = useCreateGroupMutation(currentUser?.id);
  const joinGroupMutation = useJoinGroupMutation(currentUser?.id);

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
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel criar o grupo.');
    }
  };

  const handleJoinGroup = async () => {
    if (joinCode.trim().length < 6) {
      Alert.alert('Grupo', 'Informe um codigo valido com 6 caracteres.');
      return;
    }

    try {
      const targetGroupId = await joinGroupMutation.mutateAsync(joinCode);
      setJoinCode('');
      setIsJoinModalVisible(false);
      navigation.navigate('GroupDetails', { groupId: targetGroupId });
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Nao foi possivel entrar no grupo.');
    }
  };

  const handleShareCode = async (title: string, shareCode: string) => {
    try {
      await Share.share({
        message: `Entre no grupo "${title}" com o codigo ${shareCode}.`,
      });
    } catch (error) {
      Alert.alert('Compartilhamento', 'Nao foi possivel abrir o compartilhamento agora.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
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
            Crie grupos, acompanhe saldos e confirme pagamentos entre os membros sem perder o historico.
          </Text>

          <View style={styles.heroActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsCreateModalVisible(true)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.white} />
              <Text style={styles.primaryButtonText}>Criar grupo</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setIsJoinModalVisible(true)}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <Ionicons name="key-outline" size={18} color={colors.primary} />
              <Text style={styles.secondaryButtonText}>Entrar por codigo</Text>
            </Pressable>
          </View>
        </Card>

        {groupsQuery.isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : null}

        {!groupsQuery.isLoading && groupsQuery.data?.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="people-outline" size={28} color={colors.primary} />
            <Text style={styles.emptyTitle}>Nenhum grupo ainda</Text>
            <Text style={styles.emptyDescription}>
              Crie seu primeiro grupo ou use um codigo para entrar em um grupo existente.
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
                    {item.group.description || 'Sem descricao.'}
                  </Text>
                </View>
              </View>

              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{item.currentUserRole === 'admin' ? 'ADM' : 'Membro'}</Text>
              </View>
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
                <Ionicons name="copy-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.codeText}>{item.group.shareCode}</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => handleShareCode(item.group.title, item.group.shareCode)}
                style={({ pressed }) => [styles.codeShareButton, pressed && styles.pressed]}
              >
                <Text style={styles.codeShareText}>Compartilhar codigo</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('GroupDetails', { groupId: item.group.id })}
              style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
            >
              <Text style={styles.detailsButtonText}>Ver detalhes</Text>
            </Pressable>
          </Card>
        ))}
      </ScrollView>

      <Modal
        animationType="slide"
        transparent
        visible={isCreateModalVisible}
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Criar grupo</Text>
            <Text style={styles.modalDescription}>Defina o nome e a descricao do grupo.</Text>

            <TextInput
              value={groupTitle}
              onChangeText={setGroupTitle}
              placeholder="Nome do grupo"
              placeholderTextColor={colors.textSecondary}
              style={styles.input}
            />
            <TextInput
              value={groupDescription}
              onChangeText={setGroupDescription}
              placeholder="Descricao (opcional)"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.multilineInput]}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsCreateModalVisible(false)}
                style={({ pressed }) => [styles.secondaryButton, styles.modalActionButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleCreateGroup}
                style={({ pressed }) => [styles.primaryButton, styles.modalActionButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>
                  {createGroupMutation.isPending ? 'Criando...' : 'Criar grupo'}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent
        visible={isJoinModalVisible}
        onRequestClose={() => setIsJoinModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.modalTitle}>Entrar em grupo</Text>
            <Text style={styles.modalDescription}>Cole ou digite o codigo de compartilhamento.</Text>

            <TextInput
              value={joinCode}
              onChangeText={(value) => setJoinCode(value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              placeholder="Ex: CASA01"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
              style={styles.input}
            />

            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsJoinModalVisible(false)}
                style={({ pressed }) => [styles.secondaryButton, styles.modalActionButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={handleJoinGroup}
                style={({ pressed }) => [styles.primaryButton, styles.modalActionButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>
                  {joinGroupMutation.isPending ? 'Entrando...' : 'Entrar'}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
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
    padding: spacing.lg,
    gap: spacing.lg,
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
    color: 'rgba(255,255,255,0.84)',
  },
  heroActions: {
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primaryButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
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
    backgroundColor: '#DBEAFE',
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
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  roleBadgeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '700',
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
  codeShareButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  codeShareText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
  },
  detailsButton: {
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    gap: spacing.md,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  modalDescription: {
    ...typography.body,
    color: colors.textSecondary,
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
  },
  multilineInput: {
    minHeight: 92,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalActionButton: {
    flex: 1,
  },
});
