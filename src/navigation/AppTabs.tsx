import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { BottomTabBarMock } from '../components/BottomTabBarMock';
import { PremiumGate } from '../features/plans/components/PremiumGate';
import BudgetsScreen from '../screens/BudgetScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MenuScreen } from '../screens/MenuScreen';
import MetasScreen from '../screens/MetasScreen';
import { TransactionsScreen } from '../screens/TransictionsScreen';
import type { AuthenticatedUserSummary } from '../types/auth';
import type { AppTabParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();

type AppTabsProps = {
  currentUser: AuthenticatedUserSummary | null;
};

export function AppTabs({ currentUser }: AppTabsProps) {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBarMock {...props} />}
    >
      <Tab.Screen name="Home">
        {() => <HomeScreen currentUser={currentUser} />}
      </Tab.Screen>
      <Tab.Screen name="Transactions">
        {(props) => (
          <PremiumGate featureTitle="Extrato de transacoes">
            <TransactionsScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Tab.Screen>
      <Tab.Screen name="Goals">
        {(props) => (
          <PremiumGate featureTitle="Metas financeiras">
            <MetasScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Tab.Screen>
      <Tab.Screen name="Budget">
        {(props) => (
          <PremiumGate featureTitle="Orcamentos mensais">
            <BudgetsScreen {...(props as any)} />
          </PremiumGate>
        )}
      </Tab.Screen>
      <Tab.Screen name="Settings">
        {({ navigation }) => <MenuScreen navigation={navigation} user={currentUser} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

