import type { TextStyle } from 'react-native';

export const typography = {
  h1: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  } satisfies TextStyle,
  h2: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  } satisfies TextStyle,
  h3: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '500',
  } satisfies TextStyle,
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  } satisfies TextStyle,
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  } satisfies TextStyle,
  value: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
  } satisfies TextStyle,
} as const;

export type AppTypography = typeof typography;
