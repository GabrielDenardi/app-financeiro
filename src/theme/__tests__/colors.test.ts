import { darkColors, lightColors } from '../colors';

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('Dark theme foreground contrast', () => {
  it.each(['primary', 'success', 'danger', 'warning'] as const)(
    '%s text remains readable on surfaces and its status background',
    (name) => {
      const foreground = darkColors[`${name}Text`];
      for (const background of [
        darkColors.background,
        darkColors.surface,
        darkColors.surfaceMuted,
        darkColors.mutedSurface,
        darkColors[`${name}Soft`],
      ]) {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it.each(['primary', 'success', 'danger', 'warning'] as const)(
    '%s preserves the existing light theme foreground',
    (name) => {
      expect(lightColors[`${name}Text`]).toBe(lightColors[name]);
    },
  );

  it.each(['primary', 'primaryLight', 'danger'] as const)(
    '%s buttons retain readable white labels',
    (name) => {
      expect(contrast(darkColors.white, darkColors[name])).toBeGreaterThanOrEqual(4.5);
    },
  );
});
