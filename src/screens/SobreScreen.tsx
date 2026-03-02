import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity, 
  SafeAreaView,
  StatusBar,
  Linking
} from 'react-native';
import { FontAwesome5, MaterialCommunityIcons, Feather } from '@expo/vector-icons';

export default function SobreScreen() {
    const [rating, setRating] = useState(0);
  
  const openLink = (url: string) => {
    Linking.openURL(url).catch((err) => console.error("Erro ao abrir link", err));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton}>
             <Feather name="arrow-left" size={24} color="#FFFFFF" />
             <Text style={styles.backText}>Sobre o App</Text>
          </TouchableOpacity>

          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="piggy-bank" size={50} color="#FFFFFF" />
          </View>
          <Text style={styles.h1}>Finance Control</Text>
          <Text style={styles.captionHeader}>Versão 1.0.0</Text>
        </View>

        <View style={styles.bodyWrapper}>
          
          {/* RESUMO */}
          <View style={styles.card}>
            <Text style={styles.bodyTextCenter}>
              O Finance Control é o seu parceiro ideal para organizar suas finanças pessoais. Com uma inteface moderna e intuitiva, você pode controlar gastos, definir metas, dividir despesas com amigos e família e ter uma visão completa da sua vida financeira.
            </Text>
          </View>

          {/* FUNCIONALIDADES (Adicionada novamente) */}
          <View style={styles.card}>
            <Text style={styles.h2}>Funcionalidades</Text>
            {[
              "Controle completo de receitas e despesas",
              "Metas financeiras personalizadas",
              "Orçamentos mensais com alertas",
              "Grupos para dividir despesas",
              "Relatórios e gráficos detalhados",
              "Múltiplas contas e cartões",
              "Sincronização em tempo real"
            ].map((item, index) => (
              <View key={index} style={styles.listItem}>
                <View style={styles.bullet} />
                <Text style={styles.bodyText}>{item}</Text>
              </View>
            ))}
          </View>

                {/* ESTRELAS INTERATIVAS */}
            <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((i) => (
                <TouchableOpacity 
                key={i} 
                onPress={() => setRating(i)} 
                activeOpacity={0.7}
                >
                <FontAwesome5 
                    name="star" 
                    size={32} 
                    color={i <= rating ? "#FBBF24" : "#D1D5DB"} 
                    solid={i <= rating} 
                    style={{ marginHorizontal: 6 }} 
                />
                </TouchableOpacity>
            ))}
            </View>

            {/* BOTÃO QUE SÓ ATIVA SE TIVER NOTA */}
            <TouchableOpacity 
            style={[styles.buttonSuccess, { opacity: rating === 0 ? 0.5 : 1 }]}
            
            disabled={rating === 0}
            onPress={() => alert(`Obrigado pela nota ${rating}!`)}
            >
            <Text style={styles.buttonText}>Avaliar App</Text>
            </TouchableOpacity>

          {/* REDES SOCIAIS */}
          <View style={[styles.card, {alignItems: 'center'}]}>
            <Text style={styles.h2}>Siga-nos</Text>
            <View style={styles.socialIconsContainer}>
              <TouchableOpacity onPress={() => openLink('https://instagram.com')}><FontAwesome5 name="instagram" size={28} color="#0F172A" style={styles.socialIcon} /></TouchableOpacity>
              <TouchableOpacity onPress={() => openLink('https://twitter.com')}><FontAwesome5 name="twitter" size={28} color="#0F172A" style={styles.socialIcon} /></TouchableOpacity>
              <TouchableOpacity onPress={() => openLink('https://github.com')}><FontAwesome5 name="github" size={28} color="#0F172A" style={styles.socialIcon} /></TouchableOpacity>
            </View>
          </View>

          {/* LINKS LEGAIS */}
          <View style={styles.card}>
            <TouchableOpacity style={styles.legalLink} onPress={() => openLink('https://seusite.com/termos')}>
              <Text style={styles.legalText}>Termos de Uso</Text>
              <Feather name="external-link" size={16} color="#64748B" />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.legalLink} onPress={() => openLink('https://seusite.com/privacidade')}>
              <Text style={styles.legalText}>Política de Privacidade</Text>
              <Feather name="external-link" size={16} color="#64748B" />
            </TouchableOpacity>
            <View style={styles.divider} />
          </View>

        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingBottom: 40 },
  header: {
    backgroundColor: '#1E3A8A',
    paddingTop: 20,
    paddingBottom: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 20 },
  backText: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', marginLeft: 10 },
  logoContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#16A34A',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 8,
  },
  h1: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF' },
  h2: { fontSize: 18, fontWeight: '600', color: '#0F172A', marginBottom: 12 },
  captionHeader: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  bodyWrapper: { paddingHorizontal: 24, marginTop: -30 },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  bodyText: { fontSize: 14, color: '#64748B', lineHeight: 22 },
  bodyTextCenter: { fontSize: 14, color: '#64748B', lineHeight: 22, textAlign: 'center' },
  listItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A', marginRight: 12 },
  socialIconsContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 10},
  socialIcon: { marginHorizontal: 20 },
  legalLink: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  legalText: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#F1F5F9' },
  starsContainer: { flexDirection: 'row', marginTop: 15, marginBottom: 25 },
  buttonSuccess: {
    backgroundColor: '#16A34A',
    width: '100%',
    height: 48,
    borderRadius: 12,
    marginBottom: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
  caption: { fontSize: 12, color: '#94A3B8' },
  footer: { marginTop: 10, alignItems: 'center' },
  footerText: { color: '#94A3B8', fontSize: 11, marginBottom: 4 }
});