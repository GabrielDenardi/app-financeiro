import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { Badge } from '../components/Badge';
import { BottomSheet } from '../components/BottomSheet';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { FieldCard, FieldDivider, FieldRow } from '../components/FormField';
import { Search } from 'lucide-react-native';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { PageHeader } from '../components/PageHeader';
import { PageShell } from '../components/PageShell';
import { BOTTOM_TAB_BAR_HEIGHT } from '../components/BottomTabBarMock';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import { UpgradePaywallSheet } from '../features/plans/components/UpgradePaywallSheet';
import { useCurrentPlan } from '../features/plans/hooks';
import { getUpgradeMessage } from '../features/plans/plans';
import {
  useCreateSupportConversationMutation,
  useSupportConversations,
} from '../features/support/hooks/useSupport';
import type { SupportConversationStatus } from '../features/support/types';
import {
  layout,
  radius,
  spacing,
  typography,
  type AppColors,
  useThemeColors,
} from '../theme';

type FilterTab = 'all' | 'open' | 'done';

const FILTER_TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'open', label: 'Em aberto' },
  { key: 'done', label: 'Encerrado' },
];

function statusBadge(status: SupportConversationStatus) {
  if (status === 'active') return { label: 'Ativo', tone: 'success' as const };
  if (status === 'working') return { label: 'Em andamento', tone: 'warning' as const };
  return { label: 'Encerrado', tone: 'neutral' as const };
}

export default function ListChatScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const user = useAuthenticatedUser();
  const currentPlan = useCurrentPlan(user?.id);
  const conversationsQuery = useSupportConversations(
    user?.id,
    currentPlan.entitlements.supportChat,
  );
  const createConversationMutation = useCreateSupportConversationMutation(user?.id);
  const [searchText, setSearchText] = useState('');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const filteredData = useMemo(() => {
    return (conversationsQuery.data ?? []).filter((item) => {
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'open' &&
          (item.status === 'active' || item.status === 'working')) ||
        (activeTab === 'done' && item.status === 'done');
      const matchesSearch = item.title
        .toLowerCase()
        .includes(searchText.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [activeTab, conversationsQuery.data, searchText]);

  const openChat = (id: string, chatTitle: string) =>
    navigation.navigate('Chat', { chatId: id, chatTitle });

  const handleCreateConversation = async () => {
    if (!currentPlan.entitlements.supportChat) {
      setSheetVisible(false);
      return;
    }
    try {
      const conversationId = await createConversationMutation.mutateAsync({
        title,
        message: description,
      });
      setSheetVisible(false);
      setTitle('');
      setDescription('');
      navigation.navigate('Chat', { chatId: conversationId, chatTitle: title });
    } catch {
      // error handled by mutation
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Chat de Suporte"
        subtitle="Assistente automático 24h."
        onBackPress={() => navigation.goBack()}
      />

      {!currentPlan.entitlements.supportChat ? (
        <>
          <View style={styles.paywallCard}>
            <View style={styles.paywallIcon}>
              <Text style={styles.paywallIconText}>IA</Text>
            </View>
            <Text style={styles.paywallTitle}>Chat de suporte Pro</Text>
            <Text style={styles.paywallText}>
              {getUpgradeMessage('Chat de suporte')}
            </Text>
            <Button
              label="Ver opções de desbloqueio"
              fullWidth
              onPress={() => setPaywallVisible(true)}
            />
          </View>

          <UpgradePaywallSheet
            visible={paywallVisible}
            onClose={() => setPaywallVisible(false)}
            featureTitle="Chat de suporte"
            description="Fale direto com o suporte dentro do app — recurso exclusivo do Plano Pro."
          />
        </>
      ) : (
        <>
          <View style={styles.searchBar}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar conversa..."
              placeholderTextColor={colors.textSecondary}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
            />
          </View>

          <View style={styles.chipsRow}>
            {FILTER_TABS.map((tab) => (
              <Chip
                key={tab.key}
                label={tab.label}
                selected={activeTab === tab.key}
                onPress={() => setActiveTab(tab.key)}
              />
            ))}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          >
            {conversationsQuery.isLoading ? (
              <Text style={styles.emptyText}>Carregando conversas...</Text>
            ) : filteredData.length > 0 ? (
              filteredData.map((item) => {
                const badge = statusBadge(item.status);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => openChat(item.id, item.title)}
                    style={({ pressed }) => [
                      styles.conversationCard,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.botAvatar}>
                      <Text style={styles.botAvatarText}>IA</Text>
                    </View>

                    <View style={styles.conversationBody}>
                      <View style={styles.conversationTopRow}>
                        <Text style={styles.conversationTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Badge label={badge.label} tone={badge.tone} />
                      </View>

                      <View style={styles.conversationBottomRow}>
                        <Text
                          style={styles.conversationPreview}
                          numberOfLines={1}
                        >
                          {item.lastMessage || 'Nenhuma mensagem ainda.'}
                        </Text>
                        {item.unreadCount > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                              {item.unreadCount}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyAvatar}>
                  <Text style={styles.emptyAvatarText}>IA</Text>
                </View>
                <Text style={styles.emptyTitle}>
                  {activeTab === 'all'
                    ? 'Nenhuma conversa ainda'
                    : 'Nenhuma conversa encontrada'}
                </Text>
                <Text style={styles.emptyText}>
                  Toque em "+" para iniciar um novo atendimento.
                </Text>
              </View>
            )}
          </ScrollView>

          <FloatingActionButton
            style={styles.fab}
            onPress={() => setSheetVisible(true)}
          />

          <BottomSheet
            visible={sheetVisible}
            onClose={() => setSheetVisible(false)}
            footer={(close) => (
              <>
                <Button
                  label="Cancelar"
                  variant="secondary"
                  fullWidth
                  onPress={close}
                />
                <Button
                  label={
                    createConversationMutation.isPending
                      ? 'Iniciando...'
                      : 'Iniciar conversa'
                  }
                  fullWidth
                  disabled={
                    !title.trim() ||
                    !description.trim() ||
                    createConversationMutation.isPending
                  }
                  loading={createConversationMutation.isPending}
                  onPress={handleCreateConversation}
                />
              </>
            )}
          >
            <View style={styles.sheetContent}>
              <Text style={styles.sheetTitle}>Nova conversa</Text>
              <Text style={styles.sheetSubtitle}>
                Descreva o que precisa e o assistente vai te ajudar.
              </Text>

              <FieldCard>
                <FieldRow
                  label="Assunto"
                  placeholder="Ex.: Dúvida sobre fatura"
                  value={title}
                  onChangeText={setTitle}
                />
                <FieldDivider />
                <FieldRow
                  label="Descrição"
                  placeholder="Descreva seu problema..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  inputStyle={{ minHeight: 72, textAlignVertical: 'top' }}
                />
              </FieldCard>
            </View>
          </BottomSheet>
        </>
      )}
    </PageShell>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    paywallCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.md,
    },
    paywallIcon: {
      width: 64,
      height: 64,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    paywallIconText: {
      ...typography.h1,
      color: colors.white,
      fontWeight: '700',
    },
    paywallTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    paywallText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      minHeight: 48,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
    },
    chipsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    listContent: {
      gap: spacing.sm,
      paddingBottom: BOTTOM_TAB_BAR_HEIGHT + 72,
    },
    conversationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    pressed: { opacity: 0.75 },
    botAvatar: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    botAvatarText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '700',
    },
    conversationBody: {
      flex: 1,
      gap: spacing.xs,
    },
    conversationTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    conversationTitle: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '600',
      flex: 1,
    },
    conversationBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    conversationPreview: {
      ...typography.caption,
      color: colors.textSecondary,
      flex: 1,
    },
    unreadBadge: {
      width: 20,
      height: 20,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadBadgeText: {
      ...typography.caption,
      fontSize: 10,
      color: colors.white,
      fontWeight: '700',
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: spacing.xxl,
      gap: spacing.md,
    },
    emptyAvatar: {
      width: 64,
      height: 64,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyAvatarText: {
      ...typography.h2,
      color: colors.textSecondary,
      fontWeight: '700',
    },
    emptyTitle: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    emptyText: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    fab: {
      position: 'absolute',
      right: layout.pageHorizontal,
      bottom: spacing.xl,
    },
    sheetContent: {
      gap: spacing.sm,
    },
    sheetTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    sheetSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
    },
  });
