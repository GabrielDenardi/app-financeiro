import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BackHandler,
  LayoutAnimation,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ArrowLeftRight,
  BookOpen,
  ChartPie,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Lightbulb,
  Mail,
  MessageCircle,
  Mic,
  Newspaper,
  PiggyBank,
  Receipt,
  Search,
  X,
} from "lucide-react-native";

import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { PageShell } from "../components/PageShell";
import {
  useHelpArticles,
  useHelpCategories,
} from "../features/help/hooks/useHelp";
import type { HelpArticle } from "../features/help/types";
import { filterHelpArticles } from "../features/help/utils/search";
import {
  type AppColors,
  radius,
  spacing,
  typography,
  useThemeColors,
} from "../theme";

const SUPPORT_EMAIL = "suporte@financeapp.com";

const CATEGORY_ICONS: Record<string, typeof BookOpen> = {
  transactions: ArrowLeftRight,
  cards: CreditCard,
  goals: PiggyBank,
  groups: MessageCircle,
  budgets: ChartPie,
  accounts: Receipt,
  voice: Mic,
  reports: Newspaper,
};

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

type ToneKey = "primary" | "success" | "warning" | "danger";

/** Cor fixa por categoria (tokens do tema), para o assunto ser reconhecível pela cor. */
const CATEGORY_TONES: Record<string, ToneKey> = {
  transactions: "success",
  cards: "primary",
  goals: "warning",
  groups: "primary",
  budgets: "danger",
  accounts: "primary",
  voice: "danger",
  reports: "success",
};

function getTone(colors: AppColors, key: ToneKey) {
  return {
    primary: { bg: colors.primarySoft, fg: colors.primaryLight },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
  }[key];
}

function IconBubble({
  icon: Icon,
  tone = "primary",
}: {
  icon: typeof BookOpen;
  tone?: ToneKey;
}) {
  const colors = useThemeColors();
  const { bg, fg } = getTone(colors, tone);
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.pill,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={20} color={fg} />
    </View>
  );
}

/** Lista de perguntas dentro de um único card: linhas separadas por divisor, expansíveis. */
function ArticleList({
  articles,
  expandedId,
  onToggle,
  onOpenChat,
  showCategory,
}: {
  articles: HelpArticle[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onOpenChat: () => void;
  showCategory: boolean;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [feedback, setFeedback] = useState<Record<string, boolean>>({});

  return (
    <Card noPadding>
      {articles.map((article, index) => {
        const expanded = expandedId === article.id;
        const helpful = feedback[article.id];
        return (
          <View
            key={article.id}
            style={index < articles.length - 1 && styles.divider}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={article.title}
              onPress={() => onToggle(article.id)}
              style={({ pressed }) => [styles.qRow, pressed && styles.pressed]}
            >
              <IconBubble
                icon={CATEGORY_ICONS[article.categoryCode] ?? BookOpen}
                tone={CATEGORY_TONES[article.categoryCode] ?? "primary"}
              />
              <View style={styles.flex}>
                <Text style={[styles.qTitle, expanded && styles.qTitleOpen]}>
                  {article.title}
                </Text>
                {showCategory ? (
                  <Text style={styles.caption}>{article.categoryLabel}</Text>
                ) : null}
              </View>
              <View
                style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
              >
                <ChevronDown size={20} color={colors.textSecondary} />
              </View>
            </Pressable>

            {expanded ? (
              <View style={styles.answer}>
                {article.steps.map((step, i) => (
                  <View key={step.id} style={styles.step}>
                    <Text style={styles.stepNumber}>{i + 1}</Text>
                    <Text style={styles.stepText}>{step.text}</Text>
                  </View>
                ))}

                {article.tip ? (
                  <View style={styles.tip}>
                    <Lightbulb size={16} color={colors.primaryLight} />
                    <Text style={styles.tipText}>{article.tip}</Text>
                  </View>
                ) : null}

                <View style={styles.answerFooter}>
                  <Badge
                    label={article.level}
                    tone={article.level === "Avançado" ? "warning" : "primary"}
                  />
                  {helpful === true ? (
                    <View style={styles.thanks}>
                      <CheckCircle2 size={16} color={colors.success} />
                      <Text style={styles.thanksText}>Obrigado!</Text>
                    </View>
                  ) : helpful === false ? (
                    <Pressable onPress={onOpenChat} hitSlop={8}>
                      <Text style={styles.link}>Falar com o suporte</Text>
                    </Pressable>
                  ) : (
                    <View style={styles.vote}>
                      <Text style={styles.caption}>Ajudou?</Text>
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          setFeedback((s) => ({ ...s, [article.id]: true }))
                        }
                      >
                        <Text style={styles.link}>Sim</Text>
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          setFeedback((s) => ({ ...s, [article.id]: false }))
                        }
                      >
                        <Text style={styles.link}>Não</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

export function HelpScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchText, setSearchText] = useState("");
  const [categoryCode, setCategoryCode] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categoriesQuery = useHelpCategories();
  const articlesQuery = useHelpArticles();

  const categories = categoriesQuery.data ?? [];
  const allArticles = articlesQuery.data ?? [];

  const results = useMemo(
    () => filterHelpArticles(allArticles, searchText, categoryCode),
    [allArticles, searchText, categoryCode],
  );
  const popularArticles = useMemo(
    () => allArticles.filter((article) => article.popular).slice(0, 5),
    [allArticles],
  );
  const countByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    allArticles.forEach((article) => {
      counts[article.categoryCode] = (counts[article.categoryCode] ?? 0) + 1;
    });
    return counts;
  }, [allArticles]);

  const isSearching = searchText.trim().length > 0;
  const activeCategory = categories.find((c) => c.code === categoryCode);
  const inCategory = !isSearching && activeCategory !== undefined;
  const inHome = !isSearching && !inCategory;

  const openChat = useCallback(() => navigation.navigate("ListChat"), [navigation]);

  const toggleArticle = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((current) => (current === id ? null : id));
  };
  const goHome = useCallback(() => {
    setCategoryCode(null);
    setSearchText("");
    setExpandedId(null);
  }, []);

  // O voltar do Android sai da categoria/busca antes de sair da Central.
  const canStepBack = isSearching || categoryCode !== null;
  useEffect(() => {
    if (!canStepBack) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goHome();
      return true;
    });
    return () => subscription.remove();
  }, [canStepBack, goHome]);

  const loading = articlesQuery.isLoading;
  const failed = articlesQuery.isError;
  const ready = !loading && !failed;

  return (
    <PageShell
      onBackPress={() => (canStepBack ? goHome() : navigation?.goBack())}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={styles.circleLarge} />
        <View style={styles.circleSmall} />
        <Text style={styles.heroTitle}>Central de ajuda</Text>
        <Text style={styles.heroSub}>
          Respostas rápidas para usar o app com tranquilidade.
        </Text>
        <View style={styles.searchBar}>
          <Search size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="O que você quer saber?"
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchText ? (
            <Pressable
              accessibilityLabel="Limpar busca"
              hitSlop={8}
              onPress={() => setSearchText("")}
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {loading ? <Text style={styles.status}>Carregando artigos...</Text> : null}
      {failed ? (
        <View style={styles.statusBox}>
          <Text style={styles.status}>Não foi possível carregar os artigos.</Text>
          <Button
            label="Tentar novamente"
            variant="secondary"
            size="md"
            onPress={() => articlesQuery.refetch()}
          />
        </View>
      ) : null}

      {ready && isSearching ? (
        <>
          <Text style={styles.sectionTitle}>
            {plural(results.length, "resultado", "resultados")}
          </Text>
          {results.length > 0 ? (
            <ArticleList
              articles={results}
              expandedId={expandedId}
              onToggle={toggleArticle}
              onOpenChat={openChat}
              showCategory
            />
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.qTitle}>Nada encontrado</Text>
              <Text style={styles.emptyText}>
                Tente outras palavras ou fale com a nossa equipe.
              </Text>
            </Card>
          )}
        </>
      ) : null}

      {ready && inCategory ? (
        <>
          <Pressable accessibilityRole="button" onPress={goHome} style={styles.crumb}>
            <ChevronLeft size={18} color={colors.primaryLight} />
            <Text style={styles.link}>Todos os assuntos</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>{activeCategory?.label}</Text>
          {results.length > 0 ? (
            <ArticleList
              articles={results}
              expandedId={expandedId}
              onToggle={toggleArticle}
              onOpenChat={openChat}
              showCategory={false}
            />
          ) : (
            <Text style={styles.status}>Nenhum artigo nesta categoria ainda.</Text>
          )}
        </>
      ) : null}

      {ready && inHome ? (
        <>
          {popularArticles.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Perguntas frequentes</Text>
              <ArticleList
                articles={popularArticles}
                expandedId={expandedId}
                onToggle={toggleArticle}
                onOpenChat={openChat}
                showCategory
              />
            </>
          ) : null}

          {categories.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Navegue por assunto</Text>
              <Card noPadding>
                {categories.map((category, index) => (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityLabel={category.label}
                    onPress={() => setCategoryCode(category.code)}
                    style={({ pressed }) => [
                      styles.catRow,
                      index < categories.length - 1 && styles.divider,
                      pressed && styles.pressed,
                    ]}
                  >
                    <IconBubble
                      icon={CATEGORY_ICONS[category.code] ?? BookOpen}
                      tone={CATEGORY_TONES[category.code] ?? "primary"}
                    />
                    <View style={styles.flex}>
                      <Text style={styles.qTitle}>{category.label}</Text>
                      <Text style={styles.caption}>
                        {plural(
                          countByCategory[category.code] ?? 0,
                          "artigo",
                          "artigos",
                        )}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={colors.textSecondary} />
                  </Pressable>
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {ready ? (
        <>
          <Text style={styles.sectionTitle}>Ainda com dúvida?</Text>
          <View style={styles.contactRow}>
            <Pressable
              accessibilityRole="button"
              onPress={openChat}
              style={({ pressed }) => [styles.contactTile, pressed && styles.pressed]}
            >
              <IconBubble icon={MessageCircle} />
              <Text style={styles.qTitle}>Chat</Text>
              <Text style={styles.caption}>Converse com o suporte</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              style={({ pressed }) => [styles.contactTile, pressed && styles.pressed]}
            >
              <IconBubble icon={Mail} tone="success" />
              <Text style={styles.qTitle}>E-mail</Text>
              <Text style={styles.caption}>Resposta em até 1 dia útil</Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </PageShell>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    pressed: {
      opacity: 0.7,
    },
    divider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    // Hero (cor da marca + círculos translúcidos para dar profundidade)
    hero: {
      backgroundColor: colors.primary,
      borderRadius: radius.xl,
      padding: spacing.xl,
      gap: spacing.sm,
      overflow: "hidden",
    },
    circleLarge: {
      position: "absolute",
      width: 220,
      height: 220,
      borderRadius: 110,
      right: -70,
      top: -90,
      backgroundColor: colors.whiteAlpha20,
      opacity: 0.5,
    },
    circleSmall: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: 60,
      left: -40,
      bottom: -50,
      backgroundColor: colors.whiteAlpha20,
      opacity: 0.35,
    },
    heroTitle: {
      ...typography.h1,
      color: colors.white,
    },
    heroSub: {
      ...typography.body,
      color: colors.whiteAlpha80,
      marginBottom: spacing.sm,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      height: 52,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
    },
    searchInput: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
    },

    // Textos
    sectionTitle: {
      ...typography.h2,
      color: colors.textPrimary,
      marginTop: spacing.sm,
    },
    caption: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    link: {
      ...typography.body,
      fontWeight: "700",
      color: colors.primaryLight,
    },
    crumb: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
    },

    // Linhas
    qRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
    },
    qTitle: {
      ...typography.body,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    qTitleOpen: {
      color: colors.primaryLight,
    },
    catRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
    },

    // Resposta expandida
    answer: {
      gap: spacing.md,
      paddingLeft: spacing.lg + 40 + spacing.md,
      paddingRight: spacing.lg,
      paddingBottom: spacing.lg,
    },
    step: {
      flexDirection: "row",
      gap: spacing.md,
    },
    stepNumber: {
      width: 20,
      ...typography.body,
      fontWeight: "700",
      color: colors.primaryLight,
    },
    stepText: {
      flex: 1,
      ...typography.body,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    tip: {
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
      backgroundColor: colors.primarySoft,
      borderRadius: radius.md,
    },
    tipText: {
      flex: 1,
      ...typography.caption,
      lineHeight: 18,
      color: colors.textPrimary,
    },
    answerFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    vote: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    thanks: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    thanksText: {
      ...typography.body,
      fontWeight: "600",
      color: colors.success,
    },

    // Estados
    status: {
      ...typography.body,
      textAlign: "center",
      color: colors.textSecondary,
      marginTop: spacing.xl,
    },
    statusBox: {
      alignItems: "center",
      gap: spacing.md,
    },
    emptyCard: {
      alignItems: "center",
      gap: spacing.xs,
    },
    emptyText: {
      ...typography.body,
      textAlign: "center",
      color: colors.textSecondary,
    },

    // Contato
    contactRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    contactTile: {
      flex: 1,
      gap: spacing.xs,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
