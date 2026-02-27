import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { BottomTabBarMock } from '../components/BottomTabBarMock';
import { HomeScreen } from '../screens/HomeScreen';
import { GoalsScreen } from '../screens/GoalsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import TransactionsScreen from '../screens/TransictionsScreen';
import type { AppTabParamList } from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBarMock {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

