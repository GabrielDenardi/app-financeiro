import React, { useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  PiggyBank,
} from "lucide-react-native";

import { useAboutContent } from "../features/about/hooks/useAbout";
import {
  layout,
  radius,
  spacing,
  typography,
  type AppColors,
  useThemeColors,
} from "../theme";

function iconNameFromKey(key: string): keyof typeof FontAwesome5.glyphMap {
  switch (key) {
    case "instagram": return "instagram";
    case "twitter":   return "twitter";
    case "github":    return "github";
    default:          return "link";
  }
}

export default function SobreScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const aboutQuery = useAboutContent();
  const about = aboutQuery.data;

  const openLink = (url: string) => {
    Linking.openURL(url).catch((err) =>
      console.error("Erro ao abrir link", err),
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={24} color={colors.white} />
          </Pressable>

          <View style={styles.logoContainer}>
            <PiggyBank size={36} color={colors.white} />
          </View>
          <Text style={styles.appName}>{about?.appName ?? "Finance Control"}</Text>
          <Text style={styles.appVersion}>
            Versão {about?.version ?? "1.0.0"}
          </Text>
        </View>

        <View style={styles.body}>
          {aboutQuery.isLoading ? (
            <View style={styles.card}>
              <Text style={styles.bodyTextCenter}>Carregando conteúdo...</Text>
            </View>
          ) : null}
          {aboutQuery.isError ? (
            <View style={styles.card}>
              <Text style={styles.bodyTextCenter}>
                Não foi possível carregar o conteúdo.
              </Text>
            </View>
          ) : null}

          {about ? (
            <>
              <View style={styles.card}>
                <Text style={styles.bodyTextCenter}>{about.heroBody}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Funcionalidades</Text>
                {about.features.map((item) => (
                  <View key={item.id} style={styles.listItem}>
                    <View style={styles.bullet} />
                    <Text style={styles.bodyText}>{item.title}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Avalie o app</Text>
                {ratingSubmitted ? (
                  <View style={styles.ratingThanks}>
                    <CheckCircle2 size={20} color={colors.success} />
                    <Text style={styles.ratingThanksText}>
                      Obrigado pelo seu feedback!
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((item) => (
                        <Pressable
                          key={item}
                          onPress={() => setRating(item)}
                          style={({ pressed }) => pressed && styles.pressed}
                        >
                          <FontAwesome5
                            name="star"
                            size={32}
                            color={item <= rating ? colors.warning : colors.border}
                            solid={item <= rating}
                            style={styles.star}
                          />
                        </Pressable>
                      ))}
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.ratingButton,
                        rating === 0 && styles.ratingButtonDisabled,
                        pressed && rating > 0 && styles.pressed,
                      ]}
                      disabled={rating === 0}
                      onPress={() => setRatingSubmitted(true)}
                    >
                      <Text style={styles.ratingButtonText}>
                        {about.ratingTitle}
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>

              <View style={[styles.card, styles.centerCard]}>
                <Text style={styles.sectionTitle}>Siga-nos</Text>
                <View style={styles.socialRow}>
                  {about.socialLinks.map((link) => (
                    <Pressable
                      key={link.id}
                      style={({ pressed }) => [
                        styles.socialButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => openLink(link.url)}
                    >
                      <FontAwesome5
                        name={iconNameFromKey(link.key)}
                        size={22}
                        color={colors.textPrimary}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.card}>
                {about.legalLinks.map((link, index) => (
                  <React.Fragment key={link.id}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.legalLink,
                        pressed && styles.pressed,
                      ]}
                      onPress={() => openLink(link.url)}
                    >
                      <Text style={styles.legalText}>{link.label}</Text>
                      <ExternalLink size={16} color={colors.textSecondary} />
                    </Pressable>
                    {index < about.legalLinks.length - 1 ? (
                      <View style={styles.divider} />
                    ) : null}
                  </React.Fragment>
                ))}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.primary,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingBottom: spacing.xxl,
    },
    pressed: {
      opacity: 0.75,
    },

    // Header
    header: {
      backgroundColor: colors.primary,
      paddingTop: layout.pageHeaderTop,
      paddingBottom: spacing.xxl + spacing.md,
      paddingHorizontal: layout.pageHorizontal,
      alignItems: "center",
    },
    backButton: {
      alignSelf: "flex-start",
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.whiteAlpha15,
      marginBottom: spacing.xl,
    },
    logoContainer: {
      width: 80,
      height: 80,
      backgroundColor: colors.whiteAlpha15,
      borderRadius: radius.xl,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.whiteAlpha20,
    },
    appName: {
      ...typography.h1,
      color: colors.white,
      fontWeight: "700",
    },
    appVersion: {
      ...typography.body,
      color: colors.whiteAlpha65,
      marginTop: spacing.xs,
    },

    // Body
    body: {
      paddingHorizontal: layout.pageHorizontal,
      marginTop: -spacing.xl,
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    card: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    centerCard: {
      alignItems: "center",
    },
    sectionTitle: {
      ...typography.h2,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    bodyText: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    bodyTextCenter: {
      ...typography.body,
      color: colors.textSecondary,
      lineHeight: 22,
      textAlign: "center",
    },
    listItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.sm,
      gap: spacing.md,
    },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.primary,
      flexShrink: 0,
    },

    // Rating
    starsRow: {
      flexDirection: "row",
      justifyContent: "center",
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    star: {
      marginHorizontal: spacing.xs,
    },
    ratingButton: {
      backgroundColor: colors.primaryLight,
      height: 48,
      borderRadius: radius.md,
      justifyContent: "center",
      alignItems: "center",
    },
    ratingButtonDisabled: {
      opacity: 0.4,
    },
    ratingButtonText: {
      ...typography.body,
      color: colors.white,
      fontWeight: "700",
    },
    ratingThanks: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    ratingThanksText: {
      ...typography.body,
      color: colors.success,
      fontWeight: "700",
    },

    // Social
    socialRow: {
      flexDirection: "row",
      gap: spacing.md,
      marginTop: spacing.xs,
    },
    socialButton: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },

    // Legal
    legalLink: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.md,
    },
    legalText: {
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: "500",
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
    },
  });
