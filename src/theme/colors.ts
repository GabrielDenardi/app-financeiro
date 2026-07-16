export type ThemeMode = "light" | "dark";

export type AppColors = {
  primary: string;
  primaryLight: string;
  success: string;
  danger: string;
  warning: string;
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
  whiteAlpha80: string;
  whiteAlpha65: string;
  whiteAlpha50: string;
  whiteAlpha20: string;
  whiteAlpha15: string;
  whiteAlpha08: string;
  shadow: string;
  overlay: string;
};

// Paleta da marca nitin: Abyss #02040C · Midnight #0330B0 · Sapphire #0A3FD4 · Electric #1D60F5
export const lightColors: AppColors = {
  primary: "#0330B0",
  primaryLight: "#1D60F5",
  success: "#16A34A",
  danger: "#DC2626",
  warning: "#F59E0B",
  primarySoft: "#E3EAFE",
  successSoft: "#DCFCE7",
  dangerSoft: "#FEE2E2",
  warningSoft: "#FEF3C7",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceMuted: "#F1F5F9",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  border: "#E2E8F0",
  mutedSurface: "#F1F5F9",
  white: "#FFFFFF",
  whiteAlpha80: "rgba(255, 255, 255, 0.8)",
  whiteAlpha65: "rgba(255, 255, 255, 0.65)",
  whiteAlpha50: "rgba(255, 255, 255, 0.5)",
  whiteAlpha20: "rgba(255, 255, 255, 0.2)",
  whiteAlpha15: "rgba(255, 255, 255, 0.15)",
  whiteAlpha08: "rgba(255, 255, 255, 0.08)",
  shadow: "#0F172A",
  overlay: "rgba(15, 23, 42, 0.5)",
};

export const darkColors: AppColors = {
  primary: "#0A3FD4",
  primaryLight: "#1D60F5",
  success: "#16A34A",
  danger: "#DC2626",
  warning: "#D97706",
  primarySoft: "#0A1D66",
  successSoft: "#14532D",
  dangerSoft: "#7F1D1D",
  warningSoft: "#78350F",
  background: "#02040C",
  surface: "#0B1226",
  surfaceMuted: "#111A36",
  textPrimary: "#E2E8F0",
  textSecondary: "#94A3B8",
  border: "#1B2547",
  mutedSurface: "#101833",
  white: "#FFFFFF",
  whiteAlpha80: "rgba(255, 255, 255, 0.8)",
  whiteAlpha65: "rgba(255, 255, 255, 0.65)",
  whiteAlpha50: "rgba(255, 255, 255, 0.5)",
  whiteAlpha20: "rgba(255, 255, 255, 0.2)",
  whiteAlpha15: "rgba(255, 255, 255, 0.15)",
  whiteAlpha08: "rgba(255, 255, 255, 0.08)",
  shadow: "#000000",
  overlay: "rgba(2, 4, 12, 0.72)",
};

export const colors = lightColors;

export function getColors(mode: ThemeMode): AppColors {
  return mode === "dark" ? darkColors : lightColors;
}
