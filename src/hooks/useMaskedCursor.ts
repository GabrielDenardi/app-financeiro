import { useEffect, useState } from 'react';
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from 'react-native';

/**
 * Mantém o cursor sempre no fim de um `TextInput` mascarado (valores em
 * reais, percentuais, etc.): a cada tecla, o texto inteiro é reformatado e,
 * sem isso, o Android reposiciona a seleção de forma imprevisível — fazendo
 * os dígitos entrarem fora de ordem enquanto o usuário digita.
 *
 * Uso: `<TextInput value={value} {...useMaskedCursor(value)} ... />`
 */
export function useMaskedCursor(value: string) {
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(
    undefined,
  );

  useEffect(() => {
    const length = value.length;
    setSelection({ start: length, end: length });
  }, [value]);

  return {
    selection,
    onSelectionChange: (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      setSelection(event.nativeEvent.selection);
    },
  };
}
