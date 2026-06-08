import React, { useMemo, useState } from "react";
import {
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
import { type AppColors, layout, useThemeColors } from "../theme";

const { width } = Dimensions.get("window");

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
}: {
  article: HelpArticle;
  onBack: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButtonDetail}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.detailHeaderTitle} numberOfLines={1}>
          {article.title}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{article.level}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContentPadding}>
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
          <Text style={styles.usefulText}>Este artigo foi útil?</Text>
          <View style={styles.usefulButtons}>
            <TouchableOpacity style={styles.usefulBtnYes}>
              <CheckCircle2 size={16} color={colors.success} />
              <Text style={styles.usefulBtnYesText}>Sim, ajudou!</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.usefulBtnNo}>
              <Text style={styles.usefulBtnNoText}>Não resolveu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export function HelpScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    () => articles.filter((article) => article.popular).slice(0, 3),
    [articles],
  );

  if (selectedArticle) {
    return (
      <ArticleDetail
        article={selectedArticle}
        onBack={() => setSelectedArticle(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.screenScrollContent}
      >
        <View style={styles.headerBackground}>
          <SafeAreaView>
            <View style={styles.headerTop}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation?.goBack()}
              >
                <ArrowLeft size={24} color={colors.white} />
              </TouchableOpacity>
              <View>
                <Text style={styles.headerTitle}>Central de Ajuda</Text>
                <Text style={styles.headerSubTitle}>
                  Como podemos te ajudar?
                </Text>
              </View>
            </View>

            <View style={styles.searchWrapper}>
              <View style={styles.searchContainer}>
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
                  <TouchableOpacity onPress={() => setSearchText("")}>
                    <X size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.bodyContent}>
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
                        {
                          size: 20,
                          color: colors.white,
                        },
                      )
                    ) : (
                      <Search size={20} color={colors.white} />
                    )}
                  </View>
                  <View>
                    <Text style={styles.resultsHeaderTitle}>
                      {categories.find(
                        (category) => category.code === selectedCategoryCode,
                      )?.label || "Resultados"}
                    </Text>
                    <Text style={styles.resultsHeaderSub}>
                      {articles.length}{" "}
                      {articles.length === 1 ? "artigo" : "artigos"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSearchText("");
                    setSelectedCategoryCode(null);
                  }}
                >
                  <X size={20} color={colors.white} />
                </TouchableOpacity>
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
                    <TouchableOpacity
                      key={article.id}
                      style={styles.resultItem}
                      onPress={() => setSelectedArticle(article)}
                    >
                      <View style={styles.resultItemContent}>
                        <Text style={styles.resultItemTitle}>
                          {article.title}
                        </Text>
                        <View style={styles.resultItemMeta}>
                          <View
                            style={[
                              styles.levelBadge,
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
                                styles.levelBadgeText,
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
                    </TouchableOpacity>
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
                      <TouchableOpacity
                        key={article.id}
                        style={styles.articleItem}
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
                            {article.categoryLabel} - {article.steps.length}{" "}
                            passos
                          </Text>
                        </View>
                        <ChevronRight size={18} color={colors.border} />
                      </TouchableOpacity>
                    );
                  })}
              </View>

              <Text style={styles.gridLabel}>Categorias</Text>
              <View style={styles.grid}>
                {categories.map((category) => {
                  const visual = getCategoryVisual(category.code, colors);
                  return (
                    <TouchableOpacity
                      key={category.id}
                      style={styles.gridItem}
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
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.contactCard}>
                <Text style={styles.contactTitle}>
                  Não encontrou o que precisava?
                </Text>
                <Text style={styles.contactSub}>
                  Nossa equipe de suporte está sempre disponível para ajudar.
                </Text>

                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => navigation.navigate("ListChat")}
                  >
                    <View style={styles.contactIconWrapper}>
                      <MessageCircle size={20} color={colors.primaryLight} />
                    </View>

                    <View style={styles.contactTextContainer}>
                      <Text style={styles.contactButtonText}>Chat ao vivo</Text>
                      <Text style={styles.contactButtonSubText}>
                        Abra uma conversa com suporte
                      </Text>
                    </View>

                    <ChevronRight size={18} color={colors.border} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.contactButton}>
                    <View style={styles.contactIconWrapper}>
                      <Mail size={20} color={colors.success} />
                    </View>

                    <View style={styles.contactTextContainer}>
                      <Text style={styles.contactButtonText}>E-mail</Text>
                      <Text style={styles.contactButtonSubText}>
                        suporte@financeapp.com
                      </Text>
                    </View>

                    <ChevronRight size={18} color={colors.border} />
                  </TouchableOpacity>
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
    screenScrollContent: {
      paddingBottom: 40,
    },
    headerBackground: {
      backgroundColor: colors.primary,
      paddingBottom: 40,
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      marginTop: layout.pageHeaderTop,
      gap: 12,
    },
    backButton: {
      padding: 8,
      borderRadius: 99,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.white,
    },
    headerSubTitle: {
      fontSize: 14,
      color: "rgba(255,255,255,0.7)",
    },
    searchWrapper: {
      paddingHorizontal: 20,
      marginTop: 25,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      height: 56,
      borderRadius: 18,
      paddingHorizontal: 16,
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 10,
    },
    searchInput: {
      flex: 1,
      marginLeft: 10,
      fontSize: 16,
      color: colors.textPrimary,
    },
    bodyContent: {
      paddingHorizontal: 20,
      marginTop: 20,
    },
    scrollContentPadding: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      padding: 20,
      marginBottom: 20,
      elevation: 2,
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: 10,
    },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
      gap: 10,
    },
    iconAmber: {
      backgroundColor: colors.warningSoft,
      padding: 6,
      borderRadius: 8,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    articleItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.mutedSurface,
    },
    categoryCircle: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    articleItemText: {
      fontSize: 15,
      fontWeight: "500",
      color: colors.textPrimary,
      flex: 1,
    },
    articleSub: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    gridLabel: {
      fontSize: 17,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 15,
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    gridItem: {
      backgroundColor: colors.surface,
      width: (width - 55) / 2,
      padding: 12,
      borderRadius: 20,
      marginBottom: 15,
      alignItems: "center",
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    gridIcon: {
      padding: 8,
      borderRadius: 10,
      marginRight: 8,
    },
    gridText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    contactCard: {
      backgroundColor: colors.primary,
      borderRadius: 24,
      padding: 20,
      marginTop: 10,
      overflow: "hidden",
    },
    contactTitle: {
      color: colors.white,
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 4,
    },
    contactSub: {
      color: "rgba(255,255,255,0.6)",
      fontSize: 14,
      marginBottom: 20,
    },
    contactActions: {
      gap: 12,
    },
    contactButton: {
      backgroundColor: "rgba(255,255,255,0.1)",
      height: 64,
      borderRadius: 16,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
    },
    contactIconWrapper: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: "rgba(255,255,255,0.1)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    contactTextContainer: {
      flex: 1,
      justifyContent: "center",
    },
    contactButtonText: {
      color: colors.white,
      fontWeight: "bold",
      fontSize: 15,
    },
    contactButtonSubText: {
      color: "rgba(255,255,255,0.5)",
      fontSize: 12,
      marginTop: 2,
    },
    emptyText: {
      textAlign: "center",
      color: colors.textSecondary,
      marginTop: 20,
    },
    detailHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
      paddingTop: 20,
    },
    backButtonDetail: {
      padding: 8,
      borderRadius: 20,
    },
    detailHeaderTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textPrimary,
    },
    badge: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    badgeText: {
      fontSize: 11,
      color: colors.white,
      fontWeight: "normal",
    },
    detailCard: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      overflow: "hidden",
      elevation: 2,
    },
    stepHeader: {
      backgroundColor: colors.primary,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    stepHeaderText: {
      color: colors.white,
      fontWeight: "bold",
      fontSize: 15,
    },
    stepContent: {
      padding: 20,
    },
    stepItem: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 20,
    },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    stepNumberText: {
      color: colors.white,
      fontSize: 13,
      fontWeight: "bold",
    },
    stepText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 22,
      marginTop: 4,
    },
    tipBox: {
      backgroundColor: colors.warningSoft,
      padding: 16,
      borderRadius: 20,
      borderLeftWidth: 4,
      borderLeftColor: colors.primaryLight,
      flexDirection: "row",
      gap: 12,
      marginTop: 24,
    },
    tipTitle: {
      fontSize: 14,
      fontWeight: "bold",
      color: colors.textPrimary,
      marginBottom: 2,
    },
    tipText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    usefulCard: {
      padding: 30,
      alignItems: "center",
    },
    usefulText: {
      color: colors.textSecondary,
      fontWeight: "600",
      marginBottom: 16,
    },
    usefulButtons: {
      flexDirection: "row",
      gap: 12,
    },
    usefulBtnYes: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.success,
    },
    usefulBtnYesText: {
      color: colors.success,
      fontWeight: "700",
    },
    usefulBtnNo: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    usefulBtnNoText: {
      color: colors.textSecondary,
      fontWeight: "600",
    },
    resultsCard: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      overflow: "hidden",
      marginBottom: 20,
      elevation: 4,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 10,
    },
    resultsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
    },
    resultsHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    resultsHeaderIcon: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: "rgba(255,255,255,0.2)",
      alignItems: "center",
      justifyContent: "center",
    },
    resultsHeaderTitle: {
      color: colors.white,
      fontSize: 18,
      fontWeight: "bold",
    },
    resultsHeaderSub: {
      color: "rgba(255,255,255,0.8)",
      fontSize: 13,
    },
    resultsList: {
      paddingVertical: 8,
    },
    resultItem: {
      flexDirection: "row",
      alignItems: "center",
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.background,
    },
    resultItemContent: {
      flex: 1,
    },
    resultItemTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.textPrimary,
      marginBottom: 6,
    },
    resultItemMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    levelBadge: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
    },
    levelBadgeText: {
      fontSize: 12,
      fontWeight: "bold",
    },
    stepsText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
  });
