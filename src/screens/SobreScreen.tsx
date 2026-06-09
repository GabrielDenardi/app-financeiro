import React, { useMemo, useState } from "react";
import {
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Feather,
  FontAwesome5,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

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
    case "instagram":
      return "instagram";
    case "twitter":
      return "twitter";
    case "github":
      return "github";
    default:
      return "link";
  }
}

export default function SobreScreen({ navigation }: any) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rating, setRating] = useState(0);
  const aboutQuery = useAboutContent();
  const about = aboutQuery.data;

  const openLink = (url: string) => {
    Linking.openURL(url).catch((error) =>
      console.error("Erro ao abrir link", error),
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={colors.white} />
            <Text style={styles.backText}>Sobre o App</Text>
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <MaterialCommunityIcons
              name="piggy-bank"
              size={50}
              color={colors.white}
            />
          </View>
          <Text style={styles.h1}>{about?.appName ?? "Finance Control"}</Text>
          <Text style={styles.captionHeader}>
            Versão {about?.version ?? "1.0.0"}
          </Text>
        </View>

        <View style={styles.bodyWrapper}>
          {aboutQuery.isLoading ? (
            <View style={styles.card}>
              <Text style={styles.bodyTextCenter}>Carregando conteúdo...</Text>
            </View>
          ) : null}
          {aboutQuery.isError ? (
            <View style={styles.card}>
              <Text style={styles.bodyTextCenter}>
                Não foi possível carregar o conteúdo institucional.
              </Text>
            </View>
          ) : null}

          {about ? (
            <>
              <View style={styles.card}>
                <Text style={styles.bodyTextCenter}>{about.heroBody}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.h2}>Funcionalidades</Text>
                {about.features.map((item) => (
                  <View key={item.id} style={styles.listItem}>
                    <View style={styles.bullet} />
                    <Text style={styles.bodyText}>{item.title}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((item) => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setRating(item)}
                    activeOpacity={0.7}
                  >
                    <FontAwesome5
                      name="star"
                      size={32}
                      color={item <= rating ? "#FBBF24" : colors.border}
                      solid={item <= rating}
                      style={styles.star}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[
                  styles.buttonSuccess,
                  { opacity: rating === 0 ? 0.5 : 1 },
                ]}
                disabled={rating === 0}
                onPress={() => alert(`Obrigado pela nota ${rating}!`)}
              >
                <Text style={styles.buttonText}>{about.ratingTitle}</Text>
              </TouchableOpacity>

              <View style={[styles.card, styles.centerCard]}>
                <Text style={styles.h2}>Siga-nos</Text>
                <View style={styles.socialIconsContainer}>
                  {about.socialLinks.map((link) => (
                    <TouchableOpacity
                      key={link.id}
                      onPress={() => openLink(link.url)}
                    >
                      <FontAwesome5
                        name={iconNameFromKey(link.key)}
                        size={28}
                        color={colors.textPrimary}
                        style={styles.socialIcon}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.card}>
                {about.legalLinks.map((link, index) => (
                  <React.Fragment key={link.id}>
                    <TouchableOpacity
                      style={styles.legalLink}
                      onPress={() => openLink(link.url)}
                    >
                      <Text style={styles.legalText}>{link.label}</Text>
                      <Feather
                        name="external-link"
                        size={16}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
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
    header: {
      backgroundColor: colors.primary,
      paddingTop: layout.pageHeaderTop,
      paddingBottom: spacing.xxl + spacing.sm,
      paddingHorizontal: layout.pageHorizontal,
      alignItems: "center",
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      marginBottom: spacing.xl,
    },
    backText: {
      color: colors.white,
      ...typography.h1,
      marginLeft: spacing.sm,
    },
    logoContainer: {
      width: 80,
      height: 80,
      backgroundColor: colors.success,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: spacing.lg,
      elevation: 8,
    },
    h1: {
      ...typography.h1,
      color: colors.white,
      fontWeight: "700",
    },
    h2: {
      ...typography.h2,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    captionHeader: {
      ...typography.body,
      color: "rgba(255,255,255,0.72)",
      marginTop: spacing.xs,
    },
    bodyWrapper: {
      paddingHorizontal: layout.pageHorizontal,
      marginTop: -30,
    },
    card: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: radius.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 4,
    },
    centerCard: {
      alignItems: "center",
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
    },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
      marginRight: spacing.md,
    },
    socialIconsContainer: {
      flexDirection: "row",
      justifyContent: "center",
      marginTop: spacing.sm,
    },
    socialIcon: {
      marginHorizontal: spacing.lg,
    },
    legalLink: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: spacing.sm + 4,
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
    starsContainer: {
      flexDirection: "row",
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      justifyContent: "center",
    },
    star: {
      marginHorizontal: 6,
    },
    buttonSuccess: {
      backgroundColor: colors.success,
      width: "100%",
      height: 48,
      borderRadius: radius.md,
      marginBottom: spacing.lg,
      justifyContent: "center",
      alignItems: "center",
    },
    buttonText: {
      color: colors.white,
      fontWeight: "700",
      fontSize: 16,
    },
  });
