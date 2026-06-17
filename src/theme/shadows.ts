import type { ViewStyle } from 'react-native';

/**
 * Tokens de sombra/elevação padronizados.
 *
 * Cada token contém apenas offset/opacity/radius/elevation. A cor da sombra
 * (`shadowColor`) deve ser aplicada pelo consumidor a partir dos tokens de
 * cor do tema — normalmente `colors.shadow` (ou uma cor de destaque, como em
 * botões flutuantes). Use sempre estes tokens em vez de valores cravados.
 *
 * Exemplo:
 *   { ...shadows.card, shadowColor: colors.shadow }
 */
type ShadowToken = Pick<
  ViewStyle,
  'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

export const shadows = {
  /** Sombra sutil para chips/itens pequenos elevados. */
  sm: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  /** Sombra padrão de cards de conteúdo. */
  card: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  /** Sombra de cards em destaque (ex.: saldo). */
  md: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  /** Sombra forte para elementos flutuantes (ex.: FAB). */
  lg: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 5,
  },
  /** Sombra superior para bottom sheets / barras inferiores. */
  sheet: {
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 24,
  },
} satisfies Record<string, ShadowToken>;

export type AppShadows = typeof shadows;
