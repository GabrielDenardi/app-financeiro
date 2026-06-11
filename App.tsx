import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { RootNavigator } from "./src/navigation/RootNavigator";
import { AppThemeProvider, useAppTheme } from "./src/theme";

import * as NavigationBar from "expo-navigation-bar";
import { useEffect } from "react";
import { AppState } from "react-native";

const queryClient = new QueryClient();

function AppNavigation() {
  const { navigationTheme } = useAppTheme();

  useEffect(() => {
    const hideNavigationBar = async () => {
      try {
        // setBehaviorAsync não é suportado com edge-to-edge (padrão no SDK 54+);
        // com edge-to-edge o gesto de swipe já é controlado pelo sistema.
        await NavigationBar.setVisibilityAsync("hidden");
      } catch {}
    };

    hideNavigationBar();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        hideNavigationBar();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
