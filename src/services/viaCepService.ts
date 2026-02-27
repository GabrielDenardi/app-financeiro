import { digitsOnly } from '../features/auth/utils/masks';

export type ViaCepAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

type ViaCepApiResponse = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

function withTimeoutSignal(timeoutMs: number): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeout),
  };
}

export async function lookupAddressByCep(cep: string): Promise<ViaCepAddress | null> {
  const cepDigits = digitsOnly(cep);

  if (cepDigits.length !== 8) {
    return null;
  }

  const { signal, dispose } = withTimeoutSignal(8000);

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, { signal });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ViaCepApiResponse;
    if (payload.erro) {
      return null;
    }

    return {
      cep: payload.cep ?? cepDigits,
      street: payload.logradouro ?? '',
      neighborhood: payload.bairro ?? '',
      city: payload.localidade ?? '',
      state: payload.uf ?? '',
    };
  } catch (error) {
    return null;
  } finally {
    dispose();
  }
}

