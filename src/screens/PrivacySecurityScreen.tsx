import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  Pressable,
  Linking,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft, ShieldCheck, Lock, Database, Download, Trash2 } from "lucide-react-native";

type PrefItem = {
  key: string;
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
};

export function PrivacySecurityScreen() {
  const navigation = useNavigation();

  const [twoFactor, setTwoFactor] = useState(false);
  const [biometry, setBiometry] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);

  const [hideValuesHome, setHideValuesHome] = useState(false);
  const [shareAnonymousStats, setShareAnonymousStats] = useState(true);

  const securityItems: PrefItem[] = useMemo(
    () => [
      {
        key: "two_factor",
        title: "Autenticação em duas etapas",
        subtitle: "Adiciona uma camada extra de segurança",
        value: twoFactor,
        onChange: setTwoFactor,
      },
      {
        key: "biometry",
        title: "Bloqueio por biometria",
        subtitle: "Use impressão digital ou Face ID",
        value: biometry,
        onChange: setBiometry,
      },
      {
        key: "login_alerts",
        title: "Alertas de login",
        subtitle: "Notificar sobre novos acessos",
        value: loginAlerts,
        onChange: setLoginAlerts,
      },
    ],
    [twoFactor, biometry, loginAlerts]
  );

  const privacyItems: PrefItem[] = useMemo(
    () => [
      {
        key: "hide_values",
        title: "Ocultar valores na tela inicial",
        subtitle: "Protege seus dados em público",
        value: hideValuesHome,
        onChange: setHideValuesHome,
      },
      {
        key: "share_stats",
        title: "Compartilhar estatísticas anônimas",
        subtitle: "Ajuda a melhorar o app",
        value: shareAnonymousStats,
        onChange: setShareAnonymousStats,
      },
    ],
    [hideValuesHome, shareAnonymousStats]
  );

  const onOpenPolicy = () => {
    Linking.openURL("https://example.com/politica-privacidade").catch(() => {});
  };

  const onExportData = () => {
    console.log("Exportar dados");
  };

  const onDeleteAccount = () => {
    console.log("Excluir conta");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <ChevronLeft size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacidade e Segurança</Text>
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<ShieldCheck size={18} />} title="Segurança" />
        {securityItems.map((item, idx) => (
          <PreferenceRow key={item.key} item={item} showDivider={idx !== securityItems.length - 1} />
        ))}
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<Lock size={18} />} title="Privacidade" />
        {privacyItems.map((item, idx) => (
          <PreferenceRow key={item.key} item={item} showDivider={idx !== privacyItems.length - 1} />
        ))}
      </View>

      <View style={styles.card}>
        <SectionTitle icon={<Database size={18} />} title="Seus Dados" />

        <Pressable onPress={onExportData} style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
          <View style={styles.actionLeft}>
            <Download size={18} />
            <Text style={styles.actionText}>Exportar meus dados</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={onDeleteAccount}
          style={({ pressed }) => [styles.actionBtn, styles.dangerBtn, pressed && styles.pressed]}
        >
          <View style={styles.actionLeft}>
            <Trash2 size={18} />
            <Text style={[styles.actionText, styles.dangerText]}>Excluir minha conta</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.policyBlock}>
        <Text style={styles.policyTitle}>Política de Privacidade</Text>
        <Text style={styles.policyText}>
          Levamos sua privacidade a sério. Seus dados financeiros são criptografados e nunca compartilhados com terceiros sem sua autorização.{"\n\n"}
          Utilizamos as melhores práticas de segurança para proteger suas informações, incluindo criptografia de ponta a ponta e servidores seguros.{"\n\n"}
          Você tem total controle sobre seus dados e pode exportá-los ou excluí-los a qualquer momento.
        </Text>

        <Pressable onPress={onOpenPolicy}>
          <Text style={styles.policyLink}>Ler política completa</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionTitle}>
      <View style={styles.sectionIcon}>{icon}</View>
      <Text style={styles.sectionText}>{title}</Text>
    </View>
  );
}

function PreferenceRow({ item, showDivider }: { item: PrefItem; showDivider: boolean }) {
  return (
    <View style={[styles.row, showDivider && styles.rowDivider]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
      </View>

      <Switch value={item.value} onValueChange={item.onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { paddingBottom: 28 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },

  card: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E9E9E9",
    overflow: "hidden",
  },

  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  sectionIcon: { width: 22, alignItems: "center" },
  sectionText: { fontSize: 14, fontWeight: "700" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: "#EFEFEF" },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 13, fontWeight: "600" },
  rowSubtitle: { fontSize: 12, color: "#777", marginTop: 2 },

  actionBtn: {
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E9E9E9",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  actionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionText: { fontSize: 13, fontWeight: "600" },

  dangerBtn: { borderColor: "#F3B9B9", backgroundColor: "#FFF5F5" },
  dangerText: { color: "#D93025" },

  pressed: { opacity: 0.7 },

  policyBlock: { marginHorizontal: 16, marginTop: 14 },
  policyTitle: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  policyText: { fontSize: 12, color: "#666", lineHeight: 18 },
  policyLink: { marginTop: 8, fontSize: 12, fontWeight: "700" },
});