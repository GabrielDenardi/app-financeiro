export type UserPreferences = {
  userId: string;
  hideValuesHome: boolean;
  biometricEnabled: boolean;
  loginAlertsEnabled: boolean;
  shareAnonymousStats: boolean;
  twoFactorEnabled: boolean;
};

export type LoginEvent = {
  id: string;
  eventType: string;
  deviceLabel: string;
  platform: string;
  createdAt: string;
};

export type MfaEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
};
