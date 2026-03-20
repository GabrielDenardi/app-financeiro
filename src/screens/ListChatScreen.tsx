import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  radius,
  spacing,
  typography,
  type AppColors,
  useThemeColors,
} from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../components/Card";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { BOTTOM_TAB_BAR_HEIGHT } from "../components/BottomTabBarMock";

type DetailsTab = "all" | "active" | "working" | "done";

const TABS: Array<{ key: DetailsTab; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Ativo" },
  { key: "working", label: "Em andamento" },
  { key: "done", label: "Encerrado" },
];

export default function ListChatScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  //Search
  const [searchText, setSearchText] = useState("");
  //Modal
  const [addTalkVisible, setAddTalkVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  //Tabs
  const [activeTab, setActiveTab] = useState<DetailsTab>("all");

  const chatList = [
    {
      id: "1",
      title: "Bug Meta",
      lastMessage: "Eu tentei acessar...",
      unreadCount: 1,
      isMe: true,
      status: "active",
    },
    {
      id: "2",
      title: "Suporte Técnico",
      lastMessage: "Pode enviar o print do erro?",
      unreadCount: 3,
      isMe: false,
      status: "working",
    },
    {
      id: "3",
      title: "Projeto Mobile",
      lastMessage: "A API já está disponível.",
      unreadCount: 0,
      isMe: true,
      status: "done",
    },
  ];

  const filteredData = useMemo(() => {
    return chatList.filter((item) => {
      const matchesTab = activeTab === "all" || item.status === activeTab;
      const matchesSearch = item.title
        .toLowerCase()
        .includes(searchText.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [searchText, activeTab]);

  const openChat = (id: any, title: string) =>
    navigation.navigate("Chat", { chatId: id, chatTitle: title });

  return (
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
          <Text style={styles.headerTitle}>Conversas</Text>
          <Text style={styles.headerSubtitle}>
            Visualize todos os seus chats abertos.
          </Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar conversa..."
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={(t) => {
              setSearchText(t);
            }}
          />
          {searchText !== "" && (
            <TouchableOpacity onPress={() => setSearchText("")}>
              <Ionicons
                name="close-outline"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

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
            <Text
              style={[
                styles.tabButtonText,
                activeTab === tab.key && styles.tabButtonTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {filteredData.length > 0 ? (
          filteredData.map((item) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => openChat(item.id, item.title)}
              activeOpacity={0.7}
            >
              <Card style={styles.conversationCard}>
                <View style={styles.conversationInner}>
                  <View style={styles.conversationText}>
                    <Ionicons name="person-circle-outline" size={25} />
                    <View>
                      <Text style={styles.conversationTitle}>{item.title}</Text>
                      <Text style={styles.conversationSubtitle}>
                        {item.isMe ? "me: " : ""}
                        {item.lastMessage}
                      </Text>
                    </View>
                  </View>

                  {item.unreadCount > 0 && (
                    <View style={styles.conversationNotification}>
                      <Text style={styles.notificationText}>
                        {item.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))
        ) : (
          <Text style={styles.emptyText}>Nada Encontrado.</Text>
        )}
      </ScrollView>

      {!addTalkVisible && (
        <FloatingActionButton
          style={styles.fab}
          onPress={() => setAddTalkVisible(true)}
        />
      )}

      <Modal
        visible={addTalkVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddTalkVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setAddTalkVisible(false)}
          />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Iniciar Chat</Text>
                <Text style={styles.modalSubtitle}>
                  Preencha as informações para ser atendido
                </Text>
              </View>
              <Ionicons
                name="close-outline"
                size={20}
                onPress={() => setAddTalkVisible(false)}
              />
            </View>

            <Text style={styles.modalLabel}>Informações</Text>
            <TextInput
              placeholder="Titulo"
              value={title}
              onChangeText={(t) => setTitle(t)}
              style={styles.modalInput}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              placeholder="Descrição"
              value={description}
              onChangeText={(t) => setDescription(t)}
              style={styles.modalInputDescription}
              placeholderTextColor={colors.textSecondary}
              multiline={true}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setAddTalkVisible(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.primaryButton,
                  (!title || !description) && styles.primaryButtonDisabled,
                ]}
                disabled={!title || !description}
              >
                <Text style={styles.primaryButtonText}>Iniciar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    //Title
    header: {
      flexDirection: "row",
      alignItems: "center",
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
      alignItems: "center",
      justifyContent: "center",
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

    //Search
    searchContainer: {
      paddingHorizontal: 20,
      marginTop: 25,
    },
    search: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.white,
      height: 56,
      borderRadius: 18,
      paddingHorizontal: spacing.lg,
      elevation: 4,
      shadowColor: colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: radius.sm,
    },
    searchInput: {
      flex: 1,
      marginLeft: 10,
      fontSize: 16,
      color: colors.textPrimary,
    },

    //Add Talk
    fab: {
      position: "absolute",
      right: spacing.lg,
      bottom: BOTTOM_TAB_BAR_HEIGHT - 40,
    },

    //Modal
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: colors.shadow,
    },
    modalBackdrop: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    modalSheet: {
      flex: 1,
      minHeight: 500,
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.lg,
      gap: spacing.md,
    },
    modalTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    modalSubtitle: {
      ...typography.body,
      color: colors.textSecondary,
    },
    modalLabel: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
      marginTop: 10,
    },
    modalInputDescription: {
      minHeight: 120,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      color: colors.textPrimary,
      textAlignVertical: "top",
    },
    modalInput: {
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.md,
      color: colors.textPrimary,
      textAlignVertical: "top",
    },

    //Modal Actions
    modalActions: {
      flexDirection: "row",
      gap: spacing.md,
      borderTopWidth: 1,
      borderColor: colors.border,
      paddingTop: 20,
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      marginBottom: 10,
      padding: 10,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButtonText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "600",
    },
    primaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      ...typography.body,
      color: colors.white,
      fontWeight: "700",
    },

    //Conversations
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: BOTTOM_TAB_BAR_HEIGHT + 72,
    },
    conversationCard: {
      minHeight: 42,
      justifyContent: "center",
      flex: 1,
    },
    conversationInner: {
      flexDirection: "row",
      justifyContent: "space-between",
      flex: 1,
    },
    conversationText: {
      flexDirection: "row",
      gap: 10,
    },
    conversationTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    conversationSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    conversationNotification: {
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      height: 20,
      width: 20,
      justifyContent: "center",
      alignItems: "center",
      position: "absolute",
      right: 0,
      bottom: 8,
    },
    notificationText: {
      color: colors.white,
      fontSize: 10,
    },
    emptyText: {
      ...typography.body,
      color: colors.textSecondary,
      fontSize: 10,
    },
    tabsRow: {
      flexDirection: "row",
      gap: spacing.sm,
      flexWrap: "wrap",
      marginTop: spacing.lg,
      margin: "auto",
    },
    tabButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tabButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    tabButtonText: {
      ...typography.caption,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    tabButtonTextActive: {
      color: colors.white,
    },
  });
