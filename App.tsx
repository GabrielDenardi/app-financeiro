import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RootNavigator } from "./src/navigation/RootNavigator";
import { RevenueCatBootstrap } from "./src/features/billing/RevenueCatBootstrap";
import { ResultModalProvider } from "./src/components/ResultModal";
import { ToastProvider } from "./src/components/Toast";
import { AppThemeProvider, useAppTheme } from "./src/theme";

import * as NavigationBar from "expo-navigation-bar";
import { useEffect } from "react";

const queryClient = new QueryClient();

function AppNavigation() {
  const { navigationTheme } = useAppTheme();

  useEffect(() => {
    // Mantém a barra de navegação do sistema sempre visível, alinhado ao
    // padrão de mercado, em vez do modo imersivo usado no início do projeto.
    NavigationBar.setVisibilityAsync("visible").catch(() => {});
  }, []);

  return (
    <>
      <RevenueCatBootstrap />
      <NavigationContainer theme={navigationTheme}>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <ToastProvider>
            <ResultModalProvider>
              <AppNavigation />
            </ResultModalProvider>
          </ToastProvider>
        </AppThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
