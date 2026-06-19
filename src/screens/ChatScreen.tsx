import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Send } from 'lucide-react-native';

import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import {
  useMarkSupportConversationReadMutation,
  useSendSupportMessageMutation,
  useSupportMessages,
} from '../features/support/hooks/useSupport';
import {
  layout,
  radius,
  spacing,
  typography,
  type AppColors,
  useThemeColors,
} from '../theme';
import { formatTime } from '../utils/format';

interface ChatRouteParams {
  chatId: string;
  chatTitle: string;
}

export default function ChatScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const user = useAuthenticatedUser();
  const route = useRoute();
  const params = route.params as ChatRouteParams;
  const messagesQuery = useSupportMessages(user?.id, params.chatId);
  const markReadMutation = useMarkSupportConversationReadMutation(user?.id);
  const sendMessageMutation = useSendSupportMessageMutation(user?.id);
  const [messageText, setMessageText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (params.chatId) {
      markReadMutation.mutate(params.chatId);
    }
  }, [params.chatId]);

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text) return;
    await sendMessageMutation.mutateAsync({
      conversationId: params.chatId,
      body: text,
    });
    setMessageText('');
  };

  const messages = messagesQuery.data ?? [];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft size={20} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.botAvatar}>
            <Text style={styles.botAvatarText}>IA</Text>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {params.chatTitle}
            </Text>
            <Text style={styles.headerSubtitle}>Assistente automático</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messageList}
          contentContainerStyle={styles.messageListContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() =>
            scrollViewRef.current?.scrollToEnd({ animated: false })
          }
        >
          {messagesQuery.isLoading ? (
            <ActivityIndicator
              color={colors.primary}
              style={{ marginTop: spacing.xl }}
            />
          ) : messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyAvatar}>
                <Text style={styles.emptyAvatarText}>IA</Text>
              </View>
              <Text style={styles.emptyTitle}>Assistente Financeiro</Text>
              <Text style={styles.emptyText}>
                Envie uma mensagem para começar o atendimento.
              </Text>
            </View>
          ) : (
            messages.map((item, index) => {
              const isUser =
                item.senderUserId === user?.id || item.senderRole === 'user';
              const prevItem = messages[index - 1];
              const prevIsUser =
                !prevItem ||
                prevItem.senderUserId === user?.id ||
                prevItem.senderRole === 'user';
              const showBotAvatar = !isUser && prevIsUser;
              const time = formatTime(item.createdAt);

              return (
                <View
                  key={item.id}
                  style={[
                    styles.messageRow,
                    isUser ? styles.messageRowUser : styles.messageRowBot,
                  ]}
                >
                  {!isUser && (
                    <View
                      style={[
                        styles.botAvatar,
                        !showBotAvatar && styles.avatarHidden,
                      ]}
                    >
                      <Text style={styles.botAvatarText}>IA</Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.bubble,
                      isUser ? styles.bubbleUser : styles.bubbleBot,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        isUser && styles.bubbleTextUser,
                      ]}
                    >
                      {item.body}
                    </Text>
                    <Text
                      style={[
                        styles.bubbleTime,
                        isUser && styles.bubbleTimeUser,
                      ]}
                    >
                      {time}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="Mensagem..."
              placeholderTextColor={colors.textSecondary}
              multiline
              scrollEnabled
              value={messageText}
              onChangeText={setMessageText}
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.sendButton,
              (!messageText.trim() || sendMessageMutation.isPending) &&
                styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}
            onPress={handleSend}
            disabled={!messageText.trim() || sendMessageMutation.isPending}
          >
            {sendMessageMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Send size={18} color={colors.white} />
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
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
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    pressed: { opacity: 0.75 },
    botAvatar: {
      width: 36,
      height: 36,
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
    avatarHidden: {
      opacity: 0,
    },
    headerInfo: {
      flex: 1,
      gap: spacing.xs / 2,
    },
    headerTitle: {
      ...typography.h3,
      color: colors.textPrimary,
    },
    headerSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
    },
    messageList: {
      flex: 1,
    },
    messageListContent: {
      paddingHorizontal: layout.pageHorizontal,
      paddingVertical: spacing.lg,
      gap: spacing.sm,
    },
    emptyState: {
      alignItems: 'center',
      paddingTop: spacing.xxl * 2,
      gap: spacing.md,
    },
    emptyAvatar: {
      width: 72,
      height: 72,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyAvatarText: {
      ...typography.h1,
      color: colors.white,
      fontWeight: '700',
    },
    emptyTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    messageRowUser: {
      flexDirection: 'row-reverse',
    },
    messageRowBot: {
      flexDirection: 'row',
    },
    bubble: {
      maxWidth: '75%',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      borderRadius: radius.lg,
      gap: spacing.xs,
    },
    bubbleUser: {
      backgroundColor: colors.primaryLight,
      borderBottomRightRadius: 4,
    },
    bubbleBot: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomLeftRadius: 4,
    },
    bubbleText: {
      ...typography.body,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    bubbleTextUser: {
      color: colors.white,
    },
    bubbleTime: {
      ...typography.caption,
      fontSize: 10,
      color: colors.textSecondary,
      alignSelf: 'flex-end',
    },
    bubbleTimeUser: {
      color: colors.whiteAlpha65,
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      paddingHorizontal: layout.pageHorizontal,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    inputWrap: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: 44,
      maxHeight: 120,
      justifyContent: 'center',
    },
    textInput: {
      ...typography.body,
      color: colors.textPrimary,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
  });
