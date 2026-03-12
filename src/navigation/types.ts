export type AppTabParamList = {
  Home: undefined;
  Transactions: undefined;
  Goals: undefined;
  Budget: undefined;
  Settings: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  EditProfile: undefined;
  Help: undefined;
  Privacy: undefined;
  Import: undefined;
  About: undefined;
  Budgets: undefined;
  Reports: undefined;
  Accounts: undefined;
  Cards: undefined;
  Groups: undefined;
  ListChat: undefined;
  GroupDetails: { groupId: string };
};

export type AuthStackParamList = {
  Welcome: undefined;
  Cpf: undefined;
  ExistingPassword: undefined;
  RegisterEmail: undefined;
  RegisterPhone: undefined;
  RegisterFullName: undefined;
  RegisterBirthDate: undefined;
  RegisterBirthCountry: undefined;
  RegisterMotherName: undefined;
  RegisterCep: undefined;
  RegisterAddress: undefined;
  RegisterCity: undefined;
  RegisterState: undefined;
  RegisterConsent: undefined;
  RegisterPassword: undefined;
  EmailConfirmation: { email: string };
};

