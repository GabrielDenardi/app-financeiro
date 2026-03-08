import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { BottomTabBarMock } from '../components/BottomTabBarMock';
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
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Goals" component={MetasScreen} />
      <Tab.Screen name="Settings">
        {({ navigation }) => <MenuScreen navigation={navigation} user={currentUser} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

