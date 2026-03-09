import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  CpfScreen,
  EmailConfirmationScreen,
  ExistingPasswordScreen,
  RegisterAddressScreen,
  RegisterBirthCountryScreen,
  RegisterBirthDateScreen,
  RegisterCepScreen,
  RegisterCityScreen,
  RegisterConsentScreen,
  RegisterEmailScreen,
  RegisterFullNameScreen,
  RegisterMotherNameScreen,
  RegisterPasswordScreen,
  RegisterPhoneScreen,
  RegisterStateScreen,
  WelcomeScreen,
} from '../features/auth/screens/AuthScreens';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Cpf" component={CpfScreen} />
      <Stack.Screen name="ExistingPassword" component={ExistingPasswordScreen} />
      <Stack.Screen name="RegisterEmail" component={RegisterEmailScreen} />
      <Stack.Screen name="RegisterPhone" component={RegisterPhoneScreen} />
      <Stack.Screen name="RegisterFullName" component={RegisterFullNameScreen} />
      <Stack.Screen name="RegisterBirthDate" component={RegisterBirthDateScreen} />
      <Stack.Screen name="RegisterBirthCountry" component={RegisterBirthCountryScreen} />
      <Stack.Screen name="RegisterMotherName" component={RegisterMotherNameScreen} />
      <Stack.Screen name="RegisterCep" component={RegisterCepScreen} />
      <Stack.Screen name="RegisterAddress" component={RegisterAddressScreen} />
      <Stack.Screen name="RegisterCity" component={RegisterCityScreen} />
      <Stack.Screen name="RegisterState" component={RegisterStateScreen} />
      <Stack.Screen name="RegisterConsent" component={RegisterConsentScreen} />
      <Stack.Screen name="RegisterPassword" component={RegisterPasswordScreen} />
      <Stack.Screen name="EmailConfirmation" component={EmailConfirmationScreen} />
    </Stack.Navigator>
  );
}

