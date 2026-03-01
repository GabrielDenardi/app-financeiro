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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabRoutes() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomTabBarMock {...props} />}
    >
      {/* Telas que estarão no RODAPÉ */}
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Goals" component={HelpScreen} />
      <Tab.Screen name="Settings" component={MenuScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={TabRoutes} />
        {/* Telas que estarão no MENU */}
        <Stack.Screen name="Help" component={HelpScreen} />{/* Favor segui o mesmo padrão na adição de mais telas */}
        <Stack.Screen name="Privacy" component={PrivacySecurityScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
