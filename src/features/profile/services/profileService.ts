import { digitsOnly } from '../../auth/utils/masks';
import { parseDateBR } from '../../auth/utils/validation';
import { supabase } from '../../../lib/supabase';
import type { UpdateUserProfileInput, UserProfile } from '../../../types/profile';

type ProfileRow = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  birth_date: string | null;
  cep: string;
  street: string;
  address_number: string;
  complement: string;
  city: string;
  state: string;
  bio: string;
};

const PROFILE_SELECT_FIELDS =
  'id, email, full_name, phone, birth_date, cep, street, address_number, complement, city, state, bio';

function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeBirthDate(birthDate: string | null): string | null {
  const normalized = birthDate?.trim() ?? '';

  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = parseDateBR(normalized);
  if (!parsed) {
    throw new Error('Data de nascimento invalida.');
  }

  return toIsoDateString(parsed);
}

function normalizeProfileUpdate(input: UpdateUserProfileInput) {
  return {
    full_name: input.fullName.trim().replace(/\s+/g, ' '),
    phone: digitsOnly(input.phone),
    birth_date: normalizeBirthDate(input.birthDate),
    cep: digitsOnly(input.cep),
    street: input.street.trim(),
    address_number: digitsOnly(input.addressNumber),
    complement: input.complement.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    bio: input.bio.trim(),
  };
}

function mapProfileRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    birthDate: row.birth_date,
    cep: row.cep,
    street: row.street,
    addressNumber: row.address_number,
    complement: row.complement,
    city: row.city,
    state: row.state,
    bio: row.bio ?? '',
  };
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_FIELDS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Perfil nao encontrado.');
  }

  return mapProfileRow(data as ProfileRow);
}

export async function updateProfile(input: UpdateUserProfileInput): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(normalizeProfileUpdate(input))
    .eq('id', input.id)
    .select(PROFILE_SELECT_FIELDS)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProfileRow(data as ProfileRow);
}
