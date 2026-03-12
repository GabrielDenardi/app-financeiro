import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RootNavigator } from './src/navigation/RootNavigator';
import { AppThemeProvider, useAppTheme } from './src/theme';

const queryClient = new QueryClient();

function AppNavigation() {
  const { navigationTheme } = useAppTheme();

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <AppNavigation />
      </AppThemeProvider>
    </QueryClientProvider>
  );
}
