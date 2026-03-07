import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BottomTabBarMock } from './src/components/BottomTabBarMock';
import { HomeScreen } from './src/screens/HomeScreen';
import { TransactionsScreen } from './src/screens/TransictionsScreen';
import { HelpScreen } from './src/screens/HelpScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { PrivacySecurityScreen } from './src/screens/PrivacySecurityScreen';
import ImportScreen from './src/screens/ImportScreen';
import SobreScreen from './src/screens/SobreScreen';
import MetasScreen from './src/screens/MetasScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabRoutes() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBarMock {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      {/* Alterado aqui para renderizar a tela correta na Tab */}
      <Tab.Screen name="Goals" component={MetasScreen} /> 
      <Tab.Screen name="Settings" component={MenuScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={TabRoutes} />
        <Stack.Screen name="Help" component={HelpScreen} />
        <Stack.Screen name="Privacy" component={PrivacySecurityScreen} />
        <Stack.Screen name="Import" component={ImportScreen} />
        <Stack.Screen name="Sobre" component={SobreScreen} />
        <Stack.Screen name="Metas" component={MetasScreen} /> 
      </Stack.Navigator>
    </NavigationContainer>
  );
}
