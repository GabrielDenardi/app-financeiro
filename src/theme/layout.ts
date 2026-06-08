import { spacing } from "./spacing";

export const layout = {
  pageHorizontal: spacing.lg,
  pageSectionGap: spacing.lg,
  pageHeaderTop: spacing.xxl + spacing.xl,
} as const;

export type AppLayout = typeof layout;
