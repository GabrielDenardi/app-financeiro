export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  birthDate: string | null;
  cep: string;
  street: string;
  addressNumber: string;
  complement: string;
  city: string;
  state: string;
  bio: string;
};

export type UpdateUserProfileInput = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  birthDate: string | null;
  cep: string;
  street: string;
  addressNumber: string;
  complement: string;
  city: string;
  state: string;
  bio: string;
};
