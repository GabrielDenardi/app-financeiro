import React, { useMemo, useState } from "react";
import {
  Image,
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
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
} from "lucide-react-native";

const brandMark = require("../../assets/brand/nitin-app-icon-1024.png");

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
        <LinearGradient
          colors={[colors.primary, colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={24} color={colors.white} />
          </Pressable>

          <Image source={brandMark} style={styles.logoContainer} resizeMode="contain" />
          <Text style={styles.appName}>{about?.appName ?? "nitin"}</Text>
          <Text style={styles.appTagline}>Seu dinheiro, sob controle.</Text>
          <View style={styles.versionBadge}>
            <Text style={styles.appVersion}>
              Versão {about?.version ?? "1.0.0"}
            </Text>
          </View>
        </LinearGradient>

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
                    <View style={styles.featureIcon}>
                      <CheckCircle2 size={16} color={colors.primaryLight} />
                    </View>
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

              <Text style={styles.footerText}>nitin © 2026 — entradas e saídas, sempre em equilíbrio</Text>
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
      paddingTop: layout.pageHeaderTop,
      paddingBottom: spacing.xxl + spacing.xl,
      paddingHorizontal: layout.pageHorizontal,
      alignItems: "center",
      borderBottomLeftRadius: radius.lg + spacing.md,
      borderBottomRightRadius: radius.lg + spacing.md,
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
      width: 88,
      height: 88,
      borderRadius: radius.xl,
      marginBottom: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 8,
    },
    appName: {
      ...typography.h1,
      fontSize: 28,
      color: colors.white,
      fontWeight: "700",
    },
    appTagline: {
      ...typography.body,
      color: colors.whiteAlpha80,
      marginTop: spacing.xs,
    },
    versionBadge: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.whiteAlpha15,
      borderWidth: 1,
      borderColor: colors.whiteAlpha20,
    },
    appVersion: {
      ...typography.caption,
      color: colors.whiteAlpha80,
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
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 12,
      elevation: 2,
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
    featureIcon: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
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
      width: 52,
      height: 52,
      borderRadius: radius.pill,
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
    footerText: {
      ...typography.caption,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.sm,
    },
  });
