import React, { useMemo } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { 
  ArrowLeft, 
  User, 
  ChevronRight, 
  LogOut 
} from 'lucide-react-native';
import { useProfile } from '../features/profile/hooks/useProfile';
import { registerLoginEvent } from '../features/preferences/services/preferencesService';
import { supabase } from '../lib/supabase';
import { type AppColors, useAppTheme } from '../theme';
import type { AuthenticatedUserSummary } from '../types/auth';
import { menuMock } from '../data/menuMock';

type MenuScreenProps = {
  navigation: any;
  user: AuthenticatedUserSummary | null;
};

const IMPLEMENTED_ROUTES = new Set([
  'Accounts',
  'Cards',
  'Goals',
  'Help',
  'Privacy',
  'Import',
  'About',
  'Budgets',
  'Reports',
  'Groups',
  'RecurringTransactions',
]);

export function MenuScreen({ navigation, user }: MenuScreenProps) {
  const { colors, isDarkMode, setDarkMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const profileQuery = useProfile(user?.id);
  const profileName = profileQuery.data?.fullName || user?.fullName || 'Usuario';
  const profileEmail = profileQuery.data?.email || user?.email || 'usuario@email.com';
  const parentNavigation = navigation?.getParent?.();

  const handleLogout = async () => {
    try {
      await registerLoginEvent('sign_out');
    } catch {
      // Ignore logging failures on sign out.
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Erro', 'Não foi possível sair agora. Tente novamente.');
    }
  };

  const handleNavigate = (page?: string) => {
    if (!page) {
      return;
    }

    if (!IMPLEMENTED_ROUTES.has(page)) {
      Alert.alert('Em breve', 'Essa tela ainda não está disponível.');
      return;
    }

    if (parentNavigation) {
      parentNavigation.navigate(page);
      return;
    }

    navigation?.navigate(page);
  };

  const handleEditProfile = () => {
    if (parentNavigation) {
      parentNavigation.navigate('EditProfile');
      return;
    }

    navigation?.navigate('EditProfile');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      <SafeAreaView style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation?.goBack()}
          >
            <ArrowLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configurações</Text>
        </View>
      </SafeAreaView>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollPadding}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profileName.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profileName}</Text>
            <Text style={styles.profileEmail}>{profileEmail}</Text>
          </View>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={handleEditProfile}
          >
            <User size={16} color={colors.textPrimary} />
            <Text style={styles.editButtonText}>Editar</Text>
          </TouchableOpacity>
        </View>

        {menuMock.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuGroup}>
              {section.items.map((item, index) => {
                const Icon = item.icon;
                const isLast = index === section.items.length - 1;

                return (
                  <View key={item.label}>
                    <TouchableOpacity 
                      style={styles.menuItem}
                      disabled={item.toggle}
                      onPress={() => handleNavigate(item.page)}
                    >
                      <View style={styles.menuItemIcon}>
                        <Icon size={20} color={colors.textSecondary} />
                      </View>
                      
                      <Text style={styles.menuItemLabel}>{item.label}</Text>

                      {item.toggle ? (
                        <Switch
                        value={item.label === 'Modo Escuro' ? isDarkMode : false}
                        onValueChange={(val) => {
                            if (item.label === 'Modo Escuro') {
                            setDarkMode(val);
                            }
                        }}
                        disabled={item.disabled}
                        thumbColor={isDarkMode ? colors.primaryLight : colors.white}
                        trackColor={{ false: colors.border, true: `${colors.primaryLight}66` }}
                        />
                      ) : item.value ? (
                        <Text style={styles.menuItemValue}>{item.value}</Text>
                      ) : (
                        <ChevronRight size={18} color={colors.border} />
                      )}
                    </TouchableOpacity>
                    {!isLast && <View style={styles.separator} />}
                  </View>
                );
              })}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color={colors.danger} />
          <Text style={styles.logoutButtonText}>Sair da Conta</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { 
    backgroundColor: colors.surface, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  scrollPadding: { padding: 20, paddingBottom: 40 },
  
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 20, fontWeight: 'bold' },
  profileInfo: { flex: 1, marginLeft: 16 },
  profileName: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  profileEmail: { fontSize: 14, color: colors.textSecondary },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  editButtonText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuGroup: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: colors.shadow,
    shadowOpacity: 0.03,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemLabel: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  menuItemValue: { fontSize: 14, color: colors.textSecondary },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 64 },

  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${colors.danger}33`,
    backgroundColor: colors.surface,
    gap: 8,
    marginTop: 8,
  },
  logoutButtonText: { color: colors.danger, fontWeight: 'normal', fontSize: 16 },

  footerNote: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },
  appInfo: { marginTop: 32, alignItems: 'center' },
  appInfoText: { fontSize: 13, color: colors.textSecondary },
});
