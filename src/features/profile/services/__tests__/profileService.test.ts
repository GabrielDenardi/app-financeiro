const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockSelectEq = jest.fn();
const mockMaybeSingle = jest.fn();
const mockUpdate = jest.fn();
const mockUpdateEq = jest.fn();
const mockUpdateSelect = jest.fn();
const mockUpdateSingle = jest.fn();

jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { getProfile, updateProfile } from '../profileService';

describe('profileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockFrom.mockImplementation(() => ({
      select: mockSelect,
      update: mockUpdate,
    }));

    mockSelect.mockImplementation(() => ({
      eq: mockSelectEq,
    }));

    mockSelectEq.mockImplementation(() => ({
      maybeSingle: mockMaybeSingle,
    }));

    mockUpdate.mockImplementation(() => ({
      eq: mockUpdateEq,
    }));

    mockUpdateEq.mockImplementation(() => ({
      select: mockUpdateSelect,
    }));

    mockUpdateSelect.mockImplementation(() => ({
      single: mockUpdateSingle,
    }));
  });

  it('loads a mapped profile by user id', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'user-1',
        email: 'henrique@teste.com',
        full_name: 'Henrique Feijo',
        phone: '11999999999',
        birth_date: '1994-06-20',
        cep: '01001000',
        street: 'Praca da Se',
        address_number: '10',
        complement: 'Sala 2',
        city: 'Sao Paulo',
        state: 'SP',
        bio: 'Texto curto',
      },
      error: null,
    });

    await expect(getProfile('user-1')).resolves.toEqual({
      id: 'user-1',
      email: 'henrique@teste.com',
      fullName: 'Henrique Feijo',
      phone: '11999999999',
      birthDate: '1994-06-20',
      cep: '01001000',
      street: 'Praca da Se',
      addressNumber: '10',
      complement: 'Sala 2',
      city: 'Sao Paulo',
      state: 'SP',
      bio: 'Texto curto',
    });
  });

  it('updates and normalizes profile fields before saving', async () => {
    mockUpdateSingle.mockResolvedValueOnce({
      data: {
        id: 'user-1',
        email: 'henrique@teste.com',
        full_name: 'Henrique Feijo',
        phone: '11999999999',
        birth_date: '1994-06-20',
        cep: '01001000',
        street: 'Praca da Se',
        address_number: '10',
        complement: '',
        city: 'Sao Paulo',
        state: 'SP',
        bio: 'Uma bio curta',
      },
      error: null,
    });

    await expect(
      updateProfile({
        id: 'user-1',
        email: 'henrique@teste.com',
        fullName: '  Henrique   Feijo  ',
        phone: '(11) 99999-9999',
        birthDate: '20/06/1994',
        cep: '01001-000',
        street: '  Praca da Se  ',
        addressNumber: '10A',
        complement: '   ',
        city: '  Sao Paulo  ',
        state: 'sp',
        bio: '  Uma bio curta  ',
      }),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'henrique@teste.com',
      fullName: 'Henrique Feijo',
      phone: '11999999999',
      birthDate: '1994-06-20',
      cep: '01001000',
      street: 'Praca da Se',
      addressNumber: '10',
      complement: '',
      city: 'Sao Paulo',
      state: 'SP',
      bio: 'Uma bio curta',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      full_name: 'Henrique Feijo',
      phone: '11999999999',
      birth_date: '1994-06-20',
      cep: '01001000',
      street: 'Praca da Se',
      address_number: '10',
      complement: '',
      city: 'Sao Paulo',
      state: 'SP',
      bio: 'Uma bio curta',
    });
  });
});
