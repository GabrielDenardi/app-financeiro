import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { PremiumGate } from '../features/plans/components/PremiumGate';
import { EditProfileScreen } from '../features/profile/screens/EditProfileScreen';
import { GroupDetailsScreen } from '../features/groups/screens/GroupDetailsScreen';
import { GroupsScreen } from '../features/groups/screens/GroupsScreen';
import { AccountsScreen } from '../screens/AccountsScreen';
import BudgetsScreen from '../screens/BudgetScreen';
import { HelpScreen } from '../screens/HelpScreen';
import MetasScreen from '../screens/MetasScreen';
import ListChatScreen from '../screens/ListChatScreen';
import ImportScreen from '../screens/ImportScreen';
import IncomeTaxScreen from '../screens/IncomeTaxScreen';
import { PrivacySecurityScreen } from '../screens/PrivacySecurityScreen';
import { PlansScreen } from '../screens/PlansScreen';
import RecurringTransactionsScreen from '../screens/RecurringTransactionsScreen';
import ReportsScreen from '../screens/ReportScreen';
import SobreScreen from '../screens/SobreScreen';
import type { AuthenticatedUserSummary } from '../types/auth';
import type { AppStackParamList } from './types';
import { AppTabs } from './AppTabs';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import ChatScreen from '../screens/ChatScreen';

const Stack = createNativeStackNavigator<AppStackParamList>();

type AppStackProps = {
  currentUser: AuthenticatedUserSummary | null;
};

export function AppStack({ currentUser }: AppStackProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {() => <AppTabs currentUser={currentUser} />}
      </Stack.Screen>
      <Stack.Screen name="EditProfile">
        {(props) => <EditProfileScreen {...props} currentUser={currentUser} />}
      </Stack.Screen>
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Privacy" component={PrivacySecurityScreen} />
      <Stack.Screen name="Plans" component={PlansScreen} />
      <Stack.Screen name="Import">
        {(props) => (
          <PremiumGate featureTitle="Importacao de dados">
            <ImportScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Stack.Screen>
      <Stack.Screen name="IncomeTax">
        {(props) => (
          <PremiumGate featureTitle="Imposto de Renda">
            <IncomeTaxScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Stack.Screen>
      <Stack.Screen name="About" component={SobreScreen} />
      <Stack.Screen name="Budgets">
        {(props) => (
          <PremiumGate featureTitle="Orcamentos mensais">
            <BudgetsScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Stack.Screen>
      <Stack.Screen name="Reports">
        {(props) => (
          <PremiumGate featureTitle="Relatorios">
            <ReportsScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Stack.Screen>
      <Stack.Screen name="Accounts">
        {(props) => (
          <PremiumGate featureTitle="Contas financeiras">
            <AccountsScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Stack.Screen>
      <Stack.Screen name="Goals">
        {(props) => (
          <PremiumGate featureTitle="Metas financeiras">
            <MetasScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Stack.Screen>
      <Stack.Screen name="ListChat">
        {(props) => (
          <PremiumGate featureTitle="Chat de suporte">
            <ListChatScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Stack.Screen>
      <Stack.Screen name="Chat">
        {(props) => (
          <PremiumGate featureTitle="Chat de suporte">
            <ChatScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Stack.Screen>
      <Stack.Screen name="RecurringTransactions">
        {(props) => (
          <PremiumGate featureTitle="Transacoes recorrentes">
            <RecurringTransactionsScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Stack.Screen>
      <Stack.Screen name="Groups">
        {() => (
          <PremiumGate featureTitle="Grupos de despesas">
            <GroupsScreen currentUser={currentUser} />
          </PremiumGate>
        )}
      </Stack.Screen>
      <Stack.Screen name="GroupDetails">
        {({ route }) => (
          <PremiumGate featureTitle="Grupos de despesas">
            <GroupDetailsScreen currentUser={currentUser} groupId={route.params.groupId} />
          </PremiumGate>
        )}
      </Stack.Screen>
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
