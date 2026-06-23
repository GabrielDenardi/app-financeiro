export type AuthSessionState = 'loading' | 'authenticated' | 'unauthenticated';

export type AuthenticatedUserSummary = {
  id: string;
  email: string | null;
  fullName: string;
};

export type RegistrationDraft = {
  cpf: string;
  email: string;
  phone: string;
  fullName: string;
  birthDate: string;
  birthCountry: string;
  motherName: string;
  cep: string;
  street: string;
  addressNumber: string;
  complement: string;
  city: string;
  state: string;
  password: string;
  consentAccepted: boolean;
};

export type ExistingAccountInfo = {
  cpf: string;
  email: string;
  emailMasked: string;
  emailConfirmed: boolean;
};

export function createEmptyRegistrationDraft(): RegistrationDraft {
  return {
    cpf: '',
    email: '',
    phone: '',
    fullName: '',
    birthDate: '',
    birthCountry: 'Brasil',
    motherName: '',
    cep: '',
    street: '',
    addressNumber: '',
    complement: '',
    city: '',
    state: '',
    password: '',
    consentAccepted: false,
  };
}

