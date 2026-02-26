import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from './src/screens/HomeScreen';
import TransactionsScreen from './src/screens/TransictionsScreen';
import { BottomTabBarMock } from './src/components/BottomTabBarMock';
import { MenuScreen } from './src/screens/MenuScreen';

const Tab = createBottomTabNavigator();

function Screen() {
  return null;
}

function TabRoutes() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBarMock {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Goals" component={Screen} />
      <Tab.Screen name="Settings" component={MenuScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <TabRoutes />
    </NavigationContainer>
  );
}
