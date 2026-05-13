import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  layout,
  radius,
  spacing,
  typography,
  type AppColors,
  useThemeColors,
} from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../components/Card';
import { useAuthenticatedUser } from '../features/auth/hooks/useAuthenticatedUser';
import {
  useMarkSupportConversationReadMutation,
  useSendSupportMessageMutation,
  useSupportMessages,
} from '../features/support/hooks/useSupport';

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
  const [settingsMenu, setSettingsMenu] = useState(false);
  const [messageText, setMessageText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (params.chatId) {
      markReadMutation.mutate(params.chatId);
    }
  }, [markReadMutation, params.chatId]);

  const handleSend = async () => {
    if (!messageText.trim()) {
      return;
    }

    await sendMessageMutation.mutateAsync({
      conversationId: params.chatId,
      body: messageText,
    });
    setMessageText('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={25}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.headerCopy}>
            <View style={styles.headerUser}>
              <Ionicons name="people-outline" size={30} />
              <Text style={styles.headerTitle}>{params.chatTitle}</Text>
            </View>

            <TouchableOpacity onPress={() => setSettingsMenu(!settingsMenu)}>
              <Ionicons name="ellipsis-vertical-circle-outline" size={30} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.scrollSection}
          ref={scrollViewRef}
          onContentSizeChange={() =>
            scrollViewRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() =>
            scrollViewRef.current?.scrollToEnd({ animated: false })
          }
        >
          {messagesQuery.isLoading ? <ActivityIndicator style={{ marginTop: 20 }} /> : null}
          {(messagesQuery.data ?? []).map((item) => {
            const isCurrentUser = item.senderUserId === user?.id || item.senderRole === 'user';
            return (
              <View
                style={
                  isCurrentUser
                    ? styles.groupMessageRight
                    : styles.groupMessageLeft
                }
                key={item.id}
              >
                <Ionicons
                  name="person-outline"
                  size={20}
                  style={{ marginTop: 15 }}
                />
                <Card style={styles.cardMessage}>
                  <Text style={styles.textMessage}>{item.body}</Text>
                  <Text style={styles.timeMessage}>
                    {new Date(item.createdAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </Card>
              </View>
            );
          })}
        </ScrollView>

        {settingsMenu && (
          <View style={styles.settingsModal}>
            <Card>
              <View style={styles.itemModal}>
                <Ionicons name="information-circle-outline" size={15} />
                <Text style={styles.textModal}>Info</Text>
              </View>
              <View style={styles.borderModal} />
              <View style={styles.itemModal}>
                <Ionicons name="warning-outline" size={15} />
                <Text style={styles.textModal}>Denúncia</Text>
              </View>
            </Card>
          </View>
        )}

        <View style={styles.actionsSection}>
          <View style={styles.inputSection}>
            <TextInput
              style={styles.textInput}
              placeholder="Escreva sua mensagem."
              multiline={true}
              scrollEnabled={true}
              value={messageText}
              onChangeText={setMessageText}
            />
            <TouchableOpacity disabled>
              <Ionicons name="attach-outline" size={25} color={colors.border} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSend}>
              <View style={styles.sendInput}>
                {sendMessageMutation.isPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Ionicons
                    name="send-outline"
                    size={25}
                    style={{ color: colors.white }}
                  />
                )}
              </View>
            </TouchableOpacity>
          </View>
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
      borderBottomWidth: 1,
      borderColor: colors.border,
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
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    headerTitle: {
      ...typography.h1,
      color: colors.textPrimary,
    },
    headerUser: {
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'center',
    },
    scrollSection: {
      marginBottom: 75,
    },
    groupMessageLeft: {
      flexDirection: 'row',
      gap: 10,
      padding: 10,
    },
    groupMessageRight: {
      flexDirection: 'row-reverse',
      gap: 10,
      padding: 10,
    },
    cardMessage: {
      maxWidth: '80%',
      minWidth: '50%',
      minHeight: 30,
      maxHeight: 300,
    },
    textMessage: {
      ...typography.body,
      marginBottom: 10,
    },
    timeMessage: {
      position: 'absolute',
      right: 10,
      bottom: 5,
      ...typography.caption,
      fontSize: 10,
    },
    actionsSection: {
      flexDirection: 'row',
      position: 'absolute',
      bottom: 0,
      width: '100%',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xs,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    inputSection: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 25,
      paddingHorizontal: 15,
      gap: 10,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    textInput: {
      flex: 1,
      paddingVertical: 8,
      fontSize: 16,
      maxHeight: 120,
    },
    sendInput: {
      backgroundColor: colors.primaryLight,
      width: 45,
      height: 45,
      borderRadius: radius.pill,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 2,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
    },
    settingsModal: {
      position: 'absolute',
      right: 10,
      top: 70,
      minWidth: 120,
    },
    itemModal: {
      flexDirection: 'row',
      gap: 5,
      alignItems: 'center',
    },
    borderModal: {
      borderWidth: 0.6,
      marginTop: 5,
      marginBottom: 5,
      borderColor: colors.border,
    },
    textModal: {
      ...typography.body,
      fontWeight: '500',
    },
  });
