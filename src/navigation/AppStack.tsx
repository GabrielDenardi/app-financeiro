import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { GroupDetailsScreen } from '../features/groups/screens/GroupDetailsScreen';
import { GroupsScreen } from '../features/groups/screens/GroupsScreen';
import BudgetsScreen from '../screens/BudgetScreen';
import { HelpScreen } from '../screens/HelpScreen';
import ImportScreen from '../screens/ImportScreen';
import { PrivacySecurityScreen } from '../screens/PrivacySecurityScreen';
import ReportsScreen from '../screens/ReportScreen';
import SobreScreen from '../screens/SobreScreen';
import type { AuthenticatedUserSummary } from '../types/auth';
import type { AppStackParamList } from './types';
import { AppTabs } from './AppTabs';

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
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Privacy" component={PrivacySecurityScreen} />
      <Stack.Screen name="Import" component={ImportScreen} />
      <Stack.Screen name="About" component={SobreScreen} />
      <Stack.Screen name="Budgets" component={BudgetsScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Groups">
        {() => <GroupsScreen currentUser={currentUser} />}
      </Stack.Screen>
      <Stack.Screen name="GroupDetails">
        {({ route }) => <GroupDetailsScreen currentUser={currentUser} groupId={route.params.groupId} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
