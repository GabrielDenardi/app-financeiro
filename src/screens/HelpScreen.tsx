import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Dimensions,
} from 'react-native';
import {
  ArrowLeft,
  Search,
  X,
  Star,
  ChevronRight,
  BookOpen,
  Zap,
  MessageCircle,
  CheckCircle2,
  Mail,
  CreditCard,
  PiggyBank,
  Mic,
  Newspaper,
  ChartPie,
  Receipt,
  ArrowLeftRight,
} from 'lucide-react-native';
import { helpMock } from '../data/helpMock';
import { ArticleHelp, HelpCategory } from '../types/finance';
import { colors } from '../theme';

const { width } = Dimensions.get('window');

const CATEGORY_CONFIG: Record<string, { color: string, bgColor: string, icon: any }> = {
  'Transações': { color: '#10b981', bgColor: '#ecfdf5', icon: ArrowLeftRight },
  'Cartões': { color: colors.primaryLight, bgColor: '#eff6ff', icon: CreditCard },
  'Metas': { color: '#f59e0b', bgColor: '#fffbeb', icon: PiggyBank },
  'Grupos': { color: '#8b5cf6', bgColor: '#f5f3ff', icon: MessageCircle },
  'Orçamentos': { color: colors.danger, bgColor: '#fef2f2', icon: ChartPie },
  'Contas': { color: colors.primary, bgColor: '#eef2ff', icon: Receipt },
  'Voz': { color: '#ec4899', bgColor: '#fdf2f8', icon: Mic },
  'Relatórios': { color: '#06b6d4', bgColor: '#ecfeff', icon: Newspaper },
};

function ArticleDetail({ article, onBack }: { article: ArticleHelp; onBack: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButtonDetail}>
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.detailHeaderTitle} numberOfLines={1}>{article.title}</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{article.level}</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContentPadding}>
        <View style={styles.detailCard}>
          <View style={styles.stepHeader}>
            <BookOpen size={16} color={colors.white} />
            <Text style={styles.stepHeaderText}>Passo a passo</Text>
          </View>
          <View style={styles.stepContent}>
            {article.steps.map((step, i) => (
              <View key={step.id} style={styles.stepItem}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{i + 1}</Text></View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {article.tip && (
          <View style={styles.tipBox}>
            <Zap size={18} color="#B45309" />
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Dica</Text>
              <Text style={styles.tipText}>{article.tip}</Text>
            </View>
          </View>
        )}

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
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<ArticleHelp | null>(null);

  const filteredArticles = useMemo(() => {
    return helpMock.filter(article => {
      const matchesSearch = article.title.toLowerCase().includes(searchText.toLowerCase());
      const matchesCategory = selectedCategory ? article.category === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [searchText, selectedCategory]);

  const popularArticles = useMemo(() => helpMock.filter(a => a.popular).slice(0, 3), []);

  if (selectedArticle) {
    return <ArticleDetail article={selectedArticle} onBack={() => setSelectedArticle(null)} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.headerBackground}>
          <SafeAreaView>
            <View style={styles.headerTop}>
              <TouchableOpacity style={styles.backButton} onPress={() => navigation?.goBack()}>
                <ArrowLeft size={24} color={colors.white} />
              </TouchableOpacity>
              <View>
                <Text style={styles.headerTitle}>Central de Ajuda</Text>
                <Text style={styles.headerSubTitle}>Como podemos te ajudar?</Text>
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
                  onChangeText={(t) => { setSearchText(t); setSelectedCategory(null); }}
                />
                {searchText !== '' && (
                  <TouchableOpacity onPress={() => setSearchText('')}>
                    <X size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.bodyContent}>

        {(searchText !== '' || selectedCategory) && (
        <View style={styles.resultsCard}>
            {/* Cabeçalho do Card (Colorido) */}
            <View style={[
            styles.resultsHeader, 
            { backgroundColor: selectedCategory ? CATEGORY_CONFIG[selectedCategory].color : colors.primary }
            ]}>
            <View style={styles.resultsHeaderLeft}>
                <View style={styles.resultsHeaderIcon}>
                {selectedCategory ? (
                    React.createElement(CATEGORY_CONFIG[selectedCategory].icon, { size: 20, color: colors.white })
                ) : (
                    <Search size={20} color={colors.white} />
                )}
                </View>
                <View>
                <Text style={styles.resultsHeaderTitle}>
                    {selectedCategory ? selectedCategory : 'Resultados'}
                </Text>
                <Text style={styles.resultsHeaderSub}>
                    {filteredArticles.length} {filteredArticles.length === 1 ? 'artigo' : 'artigos'}
                </Text>
                </View>
            </View>
            <TouchableOpacity onPress={() => {setSearchText(''); setSelectedCategory(null)}}>
                <X size={20} color={colors.white} />
            </TouchableOpacity>
            </View>

            {/* Lista de Artigos */}
            <View style={styles.resultsList}>
            {filteredArticles.map(article => (
                <TouchableOpacity 
                key={article.id} 
                style={styles.resultItem} 
                onPress={() => setSelectedArticle(article)}
                >
                <View style={styles.resultItemContent}>
                    <Text style={styles.resultItemTitle}>{article.title}</Text>
                    <View style={styles.resultItemMeta}>
                    <View style={[
                        styles.levelBadge, 
                        { backgroundColor: article.level === 'Avançado' ? '#F3E8FF' : '#E0F2FE' }
                    ]}>
                        <Text style={[
                        styles.levelBadgeText, 
                        { color: article.level === 'Avançado' ? '#9333EA' : '#2563EB' }
                        ]}>
                        {article.level}
                        </Text>
                    </View>
                    <Text style={styles.stepsText}>{article.steps.length} passos</Text>
                    </View>
                </View>
                <ChevronRight size={18} color={colors.border} />
                </TouchableOpacity>
            ))}
            
            {filteredArticles.length === 0 && (
                <Text style={styles.emptyText}>Nenhum artigo encontrado.</Text>
            )}
            </View>
        </View>
        )}

          {!searchText && !selectedCategory && (
            <>
              <View style={styles.card}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.iconAmber}><Star size={16} color="#F59E0B" fill="#F59E0B" /></View>
                  <Text style={styles.cardTitle}>Mais acessados</Text>
                </View>
                    {popularArticles.map(article => {

                    const CategoryIcon = CATEGORY_CONFIG[article.category].icon;

                    return (
                        <TouchableOpacity key={article.id} style={styles.articleItem} onPress={() => setSelectedArticle(article)}>
                        <View style={[styles.categoryCircle, { backgroundColor: CATEGORY_CONFIG[article.category].bgColor }]}>
                            <CategoryIcon size={18} color={CATEGORY_CONFIG[article.category].color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.articleItemText}>{article.title}</Text>
                            <Text style={styles.articleSub}>{article.category} • {article.steps.length} passos</Text>
                        </View>
                        <ChevronRight size={18} color={colors.border} />
                        </TouchableOpacity>
                    );
                    })}
              </View>

              <Text style={styles.gridLabel}>Categorias</Text>
              <View style={styles.grid}>
                {(Object.keys(CATEGORY_CONFIG) as HelpCategory[]).map((cat) => (
                  <TouchableOpacity key={cat} style={styles.gridItem} onPress={() => setSelectedCategory(cat)}>
                    <View style={[styles.gridIcon, { backgroundColor: CATEGORY_CONFIG[cat].bgColor }]}>
                      {React.createElement(CATEGORY_CONFIG[cat].icon, { size: 18, color: CATEGORY_CONFIG[cat].color })}
                    </View>
                    <Text style={styles.gridText}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.contactCard}>
                <Text style={styles.contactTitle}>Não encontrou o que precisava?</Text>
                <Text style={styles.contactSub}>Nossa equipe de suporte está sempre disponível para ajudar.</Text>
                
                <View style={styles.contactActions}>
                    <TouchableOpacity style={styles.contactButton}>
                        <View style={styles.contactIconWrapper}>
                            <MessageCircle size={20} color={colors.primaryLight} />
                        </View>
                        
                        <View style={styles.contactTextContainer}>
                            <Text style={styles.contactButtonText}>Chat ao vivo</Text>
                            <Text style={styles.contactButtonSubText}>Resposta em minutos</Text>
                        </View>
                        
                        <ChevronRight size={18} color={colors.border} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.contactButton}>
                        <View style={styles.contactIconWrapper}>
                            <Mail size={20} color={colors.success} />
                        </View>
                        
                        <View style={styles.contactTextContainer}>
                            <Text style={styles.contactButtonText}>E-mail</Text>
                            <Text style={styles.contactButtonSubText}>suporte@financeapp.com</Text>
                        </View>
                        
                        <ChevronRight size={18} color={colors.border} />
                    </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: colors.background 
  },
  headerBackground: {
    backgroundColor: colors.primary,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: { flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    marginTop: 20, 
    gap: 12 
  },
  backButton: { 
    padding: 8, 
    borderRadius: 99,  
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: colors.white 
  },
  headerSubTitle: { 
    fontSize: 14, 
    color: 'rgba(255,255,255,0.7)' 
  },
  searchWrapper: { 
    paddingHorizontal: 20, 
    marginTop: 25 
  },
  searchContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.white,
    height: 56, 
    borderRadius: 18, 
    paddingHorizontal: 16, 
    elevation: 4,
    shadowColor: '#000', 
    shadowOpacity: 0.1, 
    shadowRadius: 10,
  },
  searchInput: { 
    flex: 1, 
    marginLeft: 10, 
    fontSize: 16, 
    color: colors.textPrimary 
  },
  bodyContent: { 
    paddingHorizontal: 20, 
    marginTop: 20 
  },
  scrollContentPadding: { 
    paddingHorizontal: 20, 
    paddingTop: 20, 
    paddingBottom: 40 
  },
  card: {
    backgroundColor: colors.white, 
    borderRadius: 24, 
    padding: 20, 
    marginBottom: 20, 
    elevation: 2,
    shadowColor: colors.shadow, 
    shadowOpacity: 0.05, 
    shadowRadius: 10,
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  sectionTitleRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 15,
    gap: 10 
  },
  iconAmber: { 
    backgroundColor: '#FFFBEB', 
    padding: 6, 
    borderRadius: 8 
  },
  cardTitle: { 
    fontSize: 17, 
    fontWeight: 'bold', 
    color: colors.textPrimary 
  },
  articleItem: {
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14,
    borderBottomWidth: 1, 
    borderBottomColor: colors.mutedSurface,
  },
  categoryCircle: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  articleItemText: { 
    fontSize: 15, 
    fontWeight: '500', 
    color: colors.textPrimary, 
    flex: 1 
  },
  articleSub: { 
    fontSize: 12, 
    color: colors.textSecondary, 
    marginTop: 2 
  },
  gridLabel: { 
    fontSize: 17, 
    fontWeight: 'bold', 
    color: colors.textPrimary, 
    marginBottom: 15 
  },
  grid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between' 
  },
  gridItem: {
    backgroundColor: colors.white,
    width: (width - 55) / 2, 
    padding: 12,
    borderRadius: 20, 
    marginBottom: 15, 
    alignItems: 'center', 
    flexDirection: 'row',
    borderWidth: 1, 
    borderColor: colors.border,
    overflow: 'hidden'
  },
  gridIcon: { 
    padding: 8, 
    borderRadius: 10, 
    marginRight: 8 
  },
  gridText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: colors.textPrimary 
  },
  contactCard: { 
    backgroundColor: colors.textPrimary, 
    borderRadius: 24, 
    padding: 20,
    marginTop: 10,
    overflow: 'hidden'
  },
  contactTitle: { 
    color: colors.white, 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 4 
  },
  contactSub: { 
    color: 'rgba(255,255,255,0.6)', 
    fontSize: 14,
    marginBottom: 20 
  },
  contactActions: {
    gap: 12, 
  },
  contactButton: {
    backgroundColor: 'rgba(255,255,255,0.1)', 
    height: 64, 
    borderRadius: 16,
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16,
  },
  contactIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactTextContainer: {
    flex: 1, 
    justifyContent: 'center',
  },
  contactButtonText: { 
    color: colors.white, 
    fontWeight: 'bold', 
    fontSize: 15,
  },
  contactButtonSubText: { 
    color: 'rgba(255,255,255,0.5)', 
    fontSize: 12,
    marginTop: 2,
  },
  miniIcon: { 
    padding: 6, 
    borderRadius: 6, 
    marginRight: 10,
  },
  emptyText: { 
    textAlign: 'center', 
    color: colors.textSecondary, 
    marginTop: 20 
  },
  detailHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    backgroundColor: colors.white, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border, 
    gap: 12, 
    paddingTop: 20 
  },
  backButtonDetail: { 
    padding: 8, 
    borderRadius: 20 
  },
  detailHeaderTitle: { 
    flex: 1, 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: colors.textPrimary 
  },
  badge: { 
    backgroundColor: colors.primaryLight, 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  badgeText: { 
    fontSize: 11, 
    color: colors.white, 
    fontWeight: 'normal' 
  },
  detailCard: { 
    backgroundColor: colors.white, 
    borderRadius: 24, 
    overflow: 'hidden', 
    elevation: 2 
  },
  stepHeader: { 
    backgroundColor: colors.textPrimary, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  stepHeaderText: { 
    color: colors.white, 
    fontWeight: 'bold', 
    fontSize: 15 
  },
  stepContent: { padding: 20 },
  stepItem: { 
    flexDirection: 'row', 
    gap: 10, 
    marginBottom: 20 
  },
  stepNumber: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    backgroundColor: colors.textPrimary, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 2
  },
  stepNumberText: { 
    color: colors.white, 
    fontSize: 13, 
    fontWeight: 'bold' 
  },
  stepText: { 
    flex: 1, 
    color: colors.textPrimary, 
    fontSize: 14, 
    lineHeight: 22,
    marginTop: 4
  },
  tipBox: { 
    backgroundColor: '#FFFBEB', 
    padding: 16, 
    borderRadius: 20, 
    borderLeftWidth: 4, 
    borderLeftColor: '#F59E0B', 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 24 
  },
  tipTitle: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#92400E', 
    marginBottom: 2 
  },
  tipText: { 
    fontSize: 13, 
    color: '#B45309', 
    lineHeight: 20 
  },
  usefulCard: { 
    padding: 30, 
    alignItems: 'center' 
  },
  usefulText: { 
    color: colors.textSecondary, 
    fontWeight: '600', 
    marginBottom: 16 
  },
  usefulButtons: { 
    flexDirection: 'row', 
    gap: 12 
  },
  usefulBtnYes: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 24, 
    paddingVertical: 12,
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: colors.success 
  },
  usefulBtnYesText: { 
    color: colors.success, 
    fontWeight: '700' 
  },
  usefulBtnNo: { 
    paddingHorizontal: 24, 
    paddingVertical: 12, 
    borderRadius: 14, 
    borderWidth: 1, 
    borderColor: colors.border 
  },
  usefulBtnNoText: { 
    color: colors.textSecondary, 
    fontWeight: '600' 
  },
  resultsCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  resultsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultsHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsHeaderTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  resultsHeaderSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  resultsList: {
    paddingVertical: 8,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  resultItemContent: {
    flex: 1,
  },
  resultItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  resultItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepsText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
