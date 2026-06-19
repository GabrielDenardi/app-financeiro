import React, { useMemo, useRef, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowLeft,
  ArrowLeftRight,
  BookOpen,
  ChartPie,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Mail,
  MessageCircle,
  Mic,
  Newspaper,
  PiggyBank,
  Receipt,
  Search,
  Star,
  X,
  Zap,
} from "lucide-react-native";

import {
  useHelpArticles,
  useHelpCategories,
} from "../features/help/hooks/useHelp";
import type { HelpArticle } from "../features/help/types";
import {
  type AppColors,
  layout,
  radius,
  spacing,
  typography,
  useThemeColors,
} from "../theme";

const CATEGORY_CONFIG: Record<string, { color: string; icon: any }> = {
  transactions: { color: "#10b981", icon: ArrowLeftRight },
  cards: { color: "#2563eb", icon: CreditCard },
  goals: { color: "#f59e0b", icon: PiggyBank },
  groups: { color: "#8b5cf6", icon: MessageCircle },
  budgets: { color: "#dc2626", icon: ChartPie },
  accounts: { color: "#1e3a8a", icon: Receipt },
  voice: { color: "#ec4899", icon: Mic },
  reports: { color: "#06b6d4", icon: Newspaper },
};

function getCategoryVisual(code: string, colors: AppColors) {
  const visual = CATEGORY_CONFIG[code] ?? {
    color: colors.primaryLight,
    icon: BookOpen,
  };
  return { ...visual, bgColor: `${visual.color}20` };
}

function ArticleDetail({
  article,
  onBack,
  onNotHelpful,
}: {
  article: HelpArticle;
  onBack: () => void;
  onNotHelpful: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [feedback, setFeedback] = useState<"idle" | "helpful">("idle");

  return (
    <View style={styles.container}>
      <View style={styles.detailHeader}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.detailBackButton,
            pressed && styles.pressed,
          ]}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.detailHeaderTitle} numberOfLines={1}>
          {article.title}
        </Text>
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>{article.level}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.detailScrollContent}>
        <View style={styles.detailCard}>
          <View style={styles.stepHeader}>
            <BookOpen size={16} color={colors.white} />
            <Text style={styles.stepHeaderText}>Passo a passo</Text>
          </View>
          <View style={styles.stepContent}>
            {article.steps.map((step, index) => (
              <View key={step.id} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {article.tip ? (
          <View style={styles.tipBox}>
            <Zap size={18} color={colors.primaryLight} />
            <View style={styles.tipCopy}>
              <Text style={styles.tipTitle}>Dica</Text>
              <Text style={styles.tipText}>{article.tip}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.usefulCard}>
          {feedback === "helpful" ? (
            <View style={styles.feedbackThanks}>
              <CheckCircle2 size={20} color={colors.success} />
              <Text style={styles.feedbackThanksText}>
                Obrigado pelo feedback!
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.usefulText}>Este artigo foi útil?</Text>
              <View style={styles.usefulButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.usefulBtnYes,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setFeedback("helpful")}
                >
                  <CheckCircle2 size={16} color={colors.success} />
                  <Text style={styles.usefulBtnYesText}>Sim, ajudou!</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.usefulBtnNo,
                    pressed && styles.pressed,
                  ]}
                  onPress={onNotHelpful}
                >
                  <Text style={styles.usefulBtnNoText}>Não resolveu</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export function HelpScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedCategoryCode, setSelectedCategoryCode] = useState<
    string | null
  >(null);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(
    null,
  );

  const categoriesQuery = useHelpCategories();
  const articlesQuery = useHelpArticles(searchText, selectedCategoryCode);

  const articles = articlesQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];
  const popularArticles = useMemo(
    () => articles.filter((a) => a.popular).slice(0, 3),
    [articles],
  );

  const handleNotHelpful = () => {
    setSelectedArticle(null);
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  if (selectedArticle) {
    return (
      <ArticleDetail
        article={selectedArticle}
        onBack={() => setSelectedArticle(null)}
        onNotHelpful={handleNotHelpful}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screenScrollContent}
      >
        <View style={styles.heroHeader}>
          <SafeAreaView>
            <View style={styles.heroTop}>
              <Pressable
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => navigation?.goBack()}
              >
                <ArrowLeft size={24} color={colors.white} />
              </Pressable>
              <View>
                <Text style={styles.heroTitle}>Central de Ajuda</Text>
                <Text style={styles.heroSubtitle}>Como podemos te ajudar?</Text>
              </View>
            </View>

            <View style={styles.searchWrapper}>
              <View style={styles.searchBar}>
                <Search size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar artigos de ajuda..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchText}
                  onChangeText={(value) => {
                    setSearchText(value);
                    setSelectedCategoryCode(null);
                  }}
                />
                {searchText ? (
                  <Pressable onPress={() => setSearchText("")}>
                    <X size={18} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          {searchText || selectedCategoryCode ? (
            <View style={styles.resultsCard}>
              <View
                style={[
                  styles.resultsHeader,
                  {
                    backgroundColor: selectedCategoryCode
                      ? getCategoryVisual(selectedCategoryCode, colors).color
                      : colors.primary,
                  },
                ]}
              >
                <View style={styles.resultsHeaderLeft}>
                  <View style={styles.resultsHeaderIcon}>
                    {selectedCategoryCode ? (
                      React.createElement(
                        getCategoryVisual(selectedCategoryCode, colors).icon,
                        { size: 20, color: colors.white },
                      )
                    ) : (
                      <Search size={20} color={colors.white} />
                    )}
                  </View>
                  <View>
                    <Text style={styles.resultsHeaderTitle}>
                      {categories.find(
                        (c) => c.code === selectedCategoryCode,
                      )?.label || "Resultados"}
                    </Text>
                    <Text style={styles.resultsHeaderSub}>
                      {articles.length}{" "}
                      {articles.length === 1 ? "artigo" : "artigos"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    setSearchText("");
                    setSelectedCategoryCode(null);
                  }}
                >
                  <X size={20} color={colors.white} />
                </Pressable>
              </View>

              <View style={styles.resultsList}>
                {articlesQuery.isLoading ? (
                  <Text style={styles.emptyText}>Carregando artigos...</Text>
                ) : null}
                {articlesQuery.isError ? (
                  <Text style={styles.emptyText}>
                    Não foi possível carregar os artigos.
                  </Text>
                ) : null}
                {!articlesQuery.isLoading &&
                  !articlesQuery.isError &&
                  articles.map((article) => (
                    <Pressable
                      key={article.id}
                      style={({ pressed }) => [
                        styles.resultItem,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => setSelectedArticle(article)}
                    >
                      <View style={styles.resultItemContent}>
                        <Text style={styles.resultItemTitle}>
                          {article.title}
                        </Text>
                        <View style={styles.resultItemMeta}>
                          <View
                            style={[
                              styles.articleLevelBadge,
                              {
                                backgroundColor:
                                  article.level === "Avançado"
                                    ? "#8b5cf620"
                                    : colors.primarySoft,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.articleLevelBadgeText,
                                {
                                  color:
                                    article.level === "Avançado"
                                      ? "#8b5cf6"
                                      : colors.primaryLight,
                                },
                              ]}
                            >
                              {article.level}
                            </Text>
                          </View>
                          <Text style={styles.stepsText}>
                            {article.steps.length} passos
                          </Text>
                        </View>
                      </View>
                      <ChevronRight size={18} color={colors.border} />
                    </Pressable>
                  ))}

                {!articlesQuery.isLoading &&
                !articlesQuery.isError &&
                articles.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Nenhum artigo encontrado.
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {!searchText && !selectedCategoryCode ? (
            <>
              <View style={styles.card}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.iconAmber}>
                    <Star
                      size={16}
                      color={colors.primaryLight}
                      fill={colors.primaryLight}
                    />
                  </View>
                  <Text style={styles.cardTitle}>Mais acessados</Text>
                </View>

                {articlesQuery.isLoading ? (
                  <Text style={styles.emptyText}>Carregando destaques...</Text>
                ) : null}
                {!articlesQuery.isLoading &&
                  popularArticles.map((article) => {
                    const visual = getCategoryVisual(
                      article.categoryCode,
                      colors,
                    );
                    return (
                      <Pressable
                        key={article.id}
                        style={({ pressed }) => [
                          styles.articleItem,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => setSelectedArticle(article)}
                      >
                        <View
                          style={[
                            styles.categoryCircle,
                            { backgroundColor: visual.bgColor },
                          ]}
                        >
                          {React.createElement(visual.icon, {
                            size: 18,
                            color: visual.color,
                          })}
                        </View>
                        <View style={styles.flex}>
                          <Text style={styles.articleItemText}>
                            {article.title}
                          </Text>
                          <Text style={styles.articleSub}>
                            {article.categoryLabel} · {article.steps.length} passos
                          </Text>
                        </View>
                        <ChevronRight size={18} color={colors.border} />
                      </Pressable>
                    );
                  })}
              </View>

              <Text style={styles.sectionLabel}>Categorias</Text>
              <View style={styles.grid}>
                {categories.map((category) => {
                  const visual = getCategoryVisual(category.code, colors);
                  return (
                    <Pressable
                      key={category.id}
                      style={({ pressed }) => [
                        styles.gridItem,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => setSelectedCategoryCode(category.code)}
                    >
                      <View
                        style={[
                          styles.gridIcon,
                          { backgroundColor: visual.bgColor },
                        ]}
                      >
                        {React.createElement(visual.icon, {
                          size: 18,
                          color: visual.color,
                        })}
                      </View>
                      <Text style={styles.gridText}>{category.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.contactCard}>
                <Text style={styles.contactTitle}>
                  Não encontrou o que precisava?
                </Text>
                <Text style={styles.contactSub}>
                  Nossa equipe está sempre disponível para ajudar.
                </Text>

                <View style={styles.contactActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.contactButton,
                      pressed && styles.contactButtonPressed,
                    ]}
                    onPress={() => navigation.navigate("ListChat")}
                  >
                    <View style={[styles.contactIconWrapper, { backgroundColor: colors.primarySoft }]}>
                      <MessageCircle size={20} color={colors.primaryLight} />
                    </View>
                    <View style={styles.contactTextContainer}>
                      <Text style={styles.contactButtonText}>Chat de suporte</Text>
                      <Text style={styles.contactButtonSubText}>
                        Abra uma conversa com o assistente
                      </Text>
                    </View>
                    <ChevronRight size={18} color={colors.border} />
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [
                      styles.contactButton,
                      pressed && styles.contactButtonPressed,
                    ]}
                  >
                    <View style={[styles.contactIconWrapper, { backgroundColor: colors.successSoft }]}>
                      <Mail size={20} color={colors.success} />
                    </View>
                    <View style={styles.contactTextContainer}>
                      <Text style={styles.contactButtonText}>E-mail</Text>
                      <Text style={styles.contactButtonSubText}>
                        suporte@financeapp.com
                      </Text>
                    </View>
                    <ChevronRight size={18} color={colors.border} />
                  </Pressable>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    tipCopy: {
      flex: 1,
    },
    pressed: {
      opacity: 0.75,
    },

    // Hero header
    screenScrollContent: {
      paddingBottom: spacing.xl,
    },
    heroHeader: {
      backgroundColor: colors.primary,
      paddingBottom: spacing.xxl,
      borderBottomLeftRadius: radius.xl,
      borderBottomRightRadius: radius.xl,
    },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: layout.pageHorizontal,
      marginTop: layout.pageHeaderTop,
      gap: spacing.md,
    },
    backButton: {
      padding: spacing.sm,
      borderRadius: radius.pill,
    },
    heroTitle: {
      ...typography.h1,
      color: colors.white,
    },
    heroSubtitle: {
      ...typography.body,
      color: "rgba(255,255,255,0.7)",
    },
    searchWrapper: {
      paddingHorizontal: layout.pageHorizontal,
      marginTop: spacing.xl,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      height: 56,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 10,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
    },

    // Body
    body: {
      paddingHorizontal: layout.pageHorizontal,
      marginTop: spacing.xl,
      gap: spacing.xl,
    },

    // Popular articles card
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    iconAmber: {
      backgroundColor: colors.warningSoft,
      padding: spacing.sm,
      borderRadius: radius.sm,
    },
    cardTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    articleItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.mutedSurface,
    },
    categoryCircle: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    articleItemText: {
      ...typography.body,
      fontWeight: "500",
      color: colors.textPrimary,
    },
    articleSub: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },

    // Categories grid
    sectionLabel: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: -spacing.sm,
    },
    gridItem: {
      backgroundColor: colors.surface,
      width: "48%",
      padding: spacing.md,
      borderRadius: radius.lg,
      alignItems: "center",
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    gridIcon: {
      padding: spacing.sm,
      borderRadius: radius.md,
    },
    gridText: {
      ...typography.body,
      fontWeight: "600",
      color: colors.textPrimary,
      flex: 1,
    },

    // Contact card
    contactCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xl,
      gap: spacing.sm,
    },
    contactTitle: {
      ...typography.h2,
      color: colors.textPrimary,
    },
    contactSub: {
      ...typography.body,
      color: colors.textSecondary,
    },
    contactActions: {
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    contactButton: {
      backgroundColor: colors.background,
      height: 64,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    contactButtonPressed: {
      backgroundColor: colors.mutedSurface,
    },
    contactIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    contactTextContainer: {
      flex: 1,
    },
    contactButtonText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "700",
    },
    contactButtonSubText: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },

    // Results
    resultsCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    resultsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: spacing.lg,
    },
    resultsHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    resultsHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.md,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    resultsHeaderTitle: {
      ...typography.h2,
      color: colors.white,
    },
    resultsHeaderSub: {
      ...typography.caption,
      color: "rgba(255,255,255,0.8)",
    },
    resultsList: {
      paddingVertical: spacing.sm,
    },
    resultItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.background,
    },
    resultItemContent: {
      flex: 1,
    },
    resultItemTitle: {
      ...typography.body,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    resultItemMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    articleLevelBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    articleLevelBadgeText: {
      ...typography.caption,
      fontWeight: "700",
    },
    stepsText: {
      ...typography.caption,
      color: colors.textSecondary,
    },

    // Empty
    emptyText: {
      ...typography.body,
      textAlign: "center",
      color: colors.textSecondary,
      marginTop: spacing.xl,
      marginBottom: spacing.lg,
    },

    // Article detail
    detailHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: layout.pageHorizontal,
      paddingTop: layout.pageHeaderTop,
      paddingBottom: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: spacing.md,
    },
    detailBackButton: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    detailHeaderTitle: {
      flex: 1,
      ...typography.h3,
      color: colors.textPrimary,
    },
    levelBadge: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
    },
    levelBadgeText: {
      ...typography.caption,
      color: colors.primaryLight,
      fontWeight: "700",
    },
    detailScrollContent: {
      paddingHorizontal: layout.pageHorizontal,
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    detailCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
    },
    stepHeader: {
      backgroundColor: colors.primary,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    stepHeaderText: {
      ...typography.body,
      color: colors.white,
      fontWeight: "700",
    },
    stepContent: {
      padding: spacing.xl,
      gap: spacing.lg,
    },
    stepItem: {
      flexDirection: "row",
      gap: spacing.md,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
      flexShrink: 0,
    },
    stepNumberText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: "700",
    },
    stepText: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      lineHeight: 22,
    },
    tipBox: {
      backgroundColor: colors.warningSoft,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderLeftWidth: 4,
      borderLeftColor: colors.primaryLight,
      flexDirection: "row",
      gap: spacing.md,
    },
    tipTitle: {
      ...typography.body,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    tipText: {
      ...typography.caption,
      color: colors.textSecondary,
      lineHeight: 20,
    },

    // Feedback
    usefulCard: {
      padding: spacing.xl,
      alignItems: "center",
      gap: spacing.md,
    },
    usefulText: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    usefulButtons: {
      flexDirection: "row",
      gap: spacing.md,
    },
    usefulBtnYes: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.success,
    },
    usefulBtnYesText: {
      ...typography.body,
      color: colors.success,
      fontWeight: "700",
    },
    usefulBtnNo: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    usefulBtnNoText: {
      ...typography.body,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    feedbackThanks: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    feedbackThanksText: {
      ...typography.body,
      color: colors.success,
      fontWeight: "700",
    },
  });
