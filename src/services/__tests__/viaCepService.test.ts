import { lookupAddressByCep } from '../viaCepService';

describe('lookupAddressByCep', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.resetAllMocks();
    global.fetch = originalFetch;
  });

  it('returns normalized address when viacep responds with data', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cep: '01001-000',
        logradouro: 'Praca da Se',
        bairro: 'Se',
        localidade: 'Sao Paulo',
        uf: 'SP',
      }),
    } as Response);

    await expect(lookupAddressByCep('01001000')).resolves.toEqual({
      cep: '01001-000',
      street: 'Praca da Se',
      neighborhood: 'Se',
      city: 'Sao Paulo',
      state: 'SP',
    });
  });

  it('returns null when cep is invalid or api returns erro', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ erro: true }),
    } as Response);

    await expect(lookupAddressByCep('00000-000')).resolves.toBeNull();
    await expect(lookupAddressByCep('123')).resolves.toBeNull();
  });
});

