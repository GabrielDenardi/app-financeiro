export const colors = {
  primary: '#1E3A8A',
  primaryLight: '#2563EB',
  success: '#16A34A',
  danger: '#DC2626',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  mutedSurface: '#F1F5F9',
  white: '#FFFFFF',
  shadow: '#0F172A',
} as const;

export type AppColors = typeof colors;
