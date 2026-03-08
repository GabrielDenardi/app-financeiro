import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HelpScreen } from '../screens/HelpScreen';
import ImportScreen from '../screens/ImportScreen';
import { PrivacySecurityScreen } from '../screens/PrivacySecurityScreen';
import SobreScreen from '../screens/SobreScreen';
import type { AuthenticatedUserSummary } from '../types/auth';
import { AppTabs } from './AppTabs';

const Stack = createNativeStackNavigator();

type AppStackProps = {
  currentUser: AuthenticatedUserSummary | null;
};

export function AppStack({ currentUser }: AppStackProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {() => <AppTabs currentUser={currentUser} />}
      </Stack.Screen>
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Privacy" component={PrivacySecurityScreen} />
      <Stack.Screen name="Import" component={ImportScreen} />
      <Stack.Screen name="About" component={SobreScreen} />
    </Stack.Navigator>
  );
}
