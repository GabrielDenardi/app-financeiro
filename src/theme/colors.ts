export type ThemeMode = 'light' | 'dark';

export type AppColors = {
  primary: string;
  primaryLight: string;
  success: string;
  danger: string;
  primarySoft: string;
  successSoft: string;
  dangerSoft: string;
  warningSoft: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  mutedSurface: string;
  white: string;
  shadow: string;
  overlay: string;
};

export const lightColors: AppColors = {
  primary: '#1E3A8A',
  primaryLight: '#2563EB',
  success: '#16A34A',
  danger: '#DC2626',
  primarySoft: '#DBEAFE',
  successSoft: '#DCFCE7',
  dangerSoft: '#FEE2E2',
  warningSoft: '#FEF3C7',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  mutedSurface: '#F1F5F9',
  white: '#FFFFFF',
  shadow: '#0F172A',
  overlay: 'rgba(15, 23, 42, 0.5)',
};

export const darkColors: AppColors = {
  primary: '#60A5FA',
  primaryLight: '#93C5FD',
  success: '#4ADE80',
  danger: '#F87171',
  primarySoft: '#172554',
  successSoft: '#14532D',
  dangerSoft: '#7F1D1D',
  warningSoft: '#78350F',
  background: '#020617',
  surface: '#0F172A',
  surfaceMuted: '#172033',
  textPrimary: '#E2E8F0',
  textSecondary: '#94A3B8',
  border: '#1E293B',
  mutedSurface: '#162235',
  white: '#FFFFFF',
  shadow: '#000000',
  overlay: 'rgba(2, 6, 23, 0.72)',
};

export const colors = lightColors;

export function getColors(mode: ThemeMode): AppColors {
  return mode === 'dark' ? darkColors : lightColors;
}
