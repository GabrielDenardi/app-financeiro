import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  type KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Card } from '../../../components/Card';
import { PageHeader } from '../../../components/PageHeader';
import { PageShell } from '../../../components/PageShell';
import { brazilStates } from '../../auth/constants/locations';
import { formatAddressNumber, formatCep, formatDateBR, formatPhoneBR, digitsOnly } from '../../auth/utils/masks';
import { isValidPhoneBR, parseDateBR } from '../../auth/utils/validation';
import { useProfile, useUpdateProfileMutation } from '../hooks/useProfile';
import { lookupAddressByCep } from '../../../services/viaCepService';
import { radius, spacing, typography, type AppColors, useThemeColors } from '../../../theme';
import type { AppStackParamList } from '../../../navigation/types';
import type { AuthenticatedUserSummary } from '../../../types/auth';
import type { UserProfile } from '../../../types/profile';

type EditProfileScreenProps = NativeStackScreenProps<AppStackParamList, 'EditProfile'> & {
  currentUser: AuthenticatedUserSummary | null;
};

type ProfileFormState = {
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  cep: string;
  street: string;
  addressNumber: string;
  complement: string;
  city: string;
  state: string;
  bio: string;
};

type FormErrors = Partial<Record<keyof ProfileFormState, string>>;

const BRAZIL_STATES = new Set<string>(brazilStates);
const BIO_MAX_LENGTH = 280;

function createInitialForm(currentUser: AuthenticatedUserSummary | null): ProfileFormState {
  return {
    fullName: currentUser?.fullName ?? '',
    email: currentUser?.email ?? '',
    phone: '',
    birthDate: '',
    cep: '',
    street: '',
    addressNumber: '',
    complement: '',
    city: '',
    state: '',
    bio: '',
  };
}

function formatStoredBirthDate(value: string | null): string {
  if (!value) {
    return '';
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

function profileToForm(profile: UserProfile): ProfileFormState {
  return {
    fullName: profile.fullName,
    email: profile.email,
    phone: formatPhoneBR(profile.phone),
    birthDate: formatStoredBirthDate(profile.birthDate),
    cep: formatCep(profile.cep),
    street: profile.street,
    addressNumber: profile.addressNumber,
    complement: profile.complement,
    city: profile.city,
    state: profile.state,
    bio: profile.bio,
  };
}

function getAvatarLetter(value: string): string {
  const normalized = value.trim();
  return normalized ? normalized.charAt(0).toUpperCase() : 'U';
}

function validateProfileForm(form: ProfileFormState): FormErrors {
  const errors: FormErrors = {};
  const normalizedName = form.fullName.trim().replace(/\s+/g, ' ');
  const phoneDigits = digitsOnly(form.phone);
  const cepDigits = digitsOnly(form.cep);
  const state = form.state.trim().toUpperCase();
  const bioLength = form.bio.length;

  if (normalizedName.split(' ').length < 2) {
    errors.fullName = 'Informe nome e sobrenome.';
  }

  if (phoneDigits.length > 0 && !isValidPhoneBR(phoneDigits)) {
    errors.phone = 'Digite um celular com DDD e 9 dígitos.';
  }

  if (form.birthDate.trim() && !parseDateBR(form.birthDate)) {
    errors.birthDate = 'Digite uma data válida no formato dd/mm/aaaa.';
  }

  if (cepDigits.length > 0 && cepDigits.length !== 8) {
    errors.cep = 'Digite um CEP válido com 8 digitos.';
  }

  if (state && !BRAZIL_STATES.has(state)) {
    errors.state = 'Informe uma UF válida.';
  }

  if (bioLength > BIO_MAX_LENGTH) {
    errors.bio = `A bio pode ter até ${BIO_MAX_LENGTH} caracteres.`;
  }

  return errors;
}

function buildUpdatePayload(currentUser: AuthenticatedUserSummary, form: ProfileFormState) {
  return {
    id: currentUser.id,
    email: form.email.trim().toLowerCase() || currentUser.email || '',
    fullName: form.fullName.trim().replace(/\s+/g, ' '),
    phone: digitsOnly(form.phone),
    birthDate: form.birthDate.trim() || null,
    cep: digitsOnly(form.cep),
    street: form.street,
    addressNumber: digitsOnly(form.addressNumber),
    complement: form.complement,
    city: form.city,
    state: form.state.trim().toUpperCase(),
    bio: form.bio,
  };
}

export function EditProfileScreen({ navigation, currentUser }: EditProfileScreenProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [form, setForm] = useState<ProfileFormState>(() => createInitialForm(currentUser));
  const [errors, setErrors] = useState<FormErrors>({});
  const [hydratedProfileId, setHydratedProfileId] = useState<string | null>(null);
  const [cepMessage, setCepMessage] = useState<string | null>(null);
  const [isLookingUpCep, setIsLookingUpCep] = useState(false);

  const profileQuery = useProfile(currentUser?.id);
  const updateProfileMutation = useUpdateProfileMutation(currentUser?.id);

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    if (hydratedProfileId === profileQuery.data.id) {
      return;
    }

    setForm(profileToForm(profileQuery.data));
    setErrors({});
    setCepMessage(null);
    setHydratedProfileId(profileQuery.data.id);
  }, [hydratedProfileId, profileQuery.data]);

  const avatarLetter = useMemo(() => getAvatarLetter(form.fullName), [form.fullName]);

  const setFieldValue = (field: keyof ProfileFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleLookupCep = async () => {
    const cepDigits = digitsOnly(form.cep);

    if (cepDigits.length === 0) {
      setCepMessage(null);
      return;
    }

    if (cepDigits.length !== 8) {
      setErrors((current) => ({
        ...current,
        cep: 'Digite um CEP válido com 8 digitos.',
      }));
      setCepMessage(null);
      return;
    }

    setIsLookingUpCep(true);
    setCepMessage(null);
    setErrors((current) => {
      if (!current.cep) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors.cep;
      return nextErrors;
    });

    try {
      const address = await lookupAddressByCep(cepDigits);

      if (!address) {
        setCepMessage('Não foi possível preencher o endereço por esse CEP.');
        return;
      }

      setForm((current) => ({
        ...current,
        street: address.street || current.street,
        city: address.city || current.city,
        state: address.state || current.state,
      }));
      setCepMessage('Endereço preenchido pelo CEP. Você pode ajustar manualmente.');
    } finally {
      setIsLookingUpCep(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser) {
      Alert.alert('Perfil', 'Não foi possível identificar o usuário atual.');
      return;
    }

    const nextErrors = validateProfileForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      const updatedProfile = await updateProfileMutation.mutateAsync(
        buildUpdatePayload(currentUser, form),
      );

      setForm(profileToForm(updatedProfile));
      setHydratedProfileId(updatedProfile.id);

      Alert.alert('Perfil', 'Alterações salvas com sucesso.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Perfil',
        error instanceof Error ? error.message : 'Não foi possível salvar o perfil agora.',
      );
    }
  };

  if (!currentUser && profileQuery.isLoading) {
    return (
      <PageShell scroll={false} contentContainerStyle={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Editar Perfil" onBackPress={() => navigation.goBack()} />

      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>
        <Text style={styles.avatarHint}>Foto opcional fora do escopo neste MVP.</Text>
      </View>

      {profileQuery.isLoading ? (
        <View style={styles.inlineState}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.inlineStateText}>Carregando informações do perfil...</Text>
        </View>
      ) : null}

      {profileQuery.isError ? (
        <Card style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Não foi possível carregar o perfil completo.</Text>
          <Text style={styles.noticeText}>
            Você ainda pode revisar os dados exibidos e tentar salvar novamente.
          </Text>
        </Card>
      ) : null}

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Informações da Conta</Text>

        <ProfileField
          colors={colors}
          styles={styles}
          label="Nome"
          placeholder="Nome e sobrenome"
          value={form.fullName}
          onChangeText={(value) => setFieldValue('fullName', value)}
          autoCapitalize="words"
          error={errors.fullName}
        />

        <ProfileField
          colors={colors}
          styles={styles}
          label="E-mail"
          placeholder="seuemail@provedor.com"
          value={form.email}
          onChangeText={(value) => setFieldValue('email', value)}
          keyboardType="email-address"
          editable={false}
          helperText="O e-mail fica somente para leitura nesta etapa."
        />
      </Card>

      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Informações Pessoais</Text>

        <ProfileField
          colors={colors}
          styles={styles}
          label="Telefone"
          placeholder="(00) 00000-0000"
          value={form.phone}
          onChangeText={(value) => setFieldValue('phone', formatPhoneBR(value))}
          keyboardType="number-pad"
          maxLength={15}
          error={errors.phone}
        />

        <ProfileField
          colors={colors}
          styles={styles}
          label="Data de Nascimento"
          placeholder="dd/mm/aaaa"
          value={form.birthDate}
          onChangeText={(value) => setFieldValue('birthDate', formatDateBR(value))}
          keyboardType="number-pad"
          maxLength={10}
          error={errors.birthDate}
        />

        <ProfileField
          colors={colors}
          styles={styles}
          label="CEP"
          placeholder="00000-000"
          value={form.cep}
          onChangeText={(value) => {
            setFieldValue('cep', formatCep(value));
            setCepMessage(null);
          }}
          keyboardType="number-pad"
          maxLength={9}
          error={errors.cep}
          helperText={cepMessage ?? 'Ao sair do campo, tentamos preencher rua, cidade e UF.'}
          onBlur={handleLookupCep}
          trailing={
            isLookingUpCep ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : undefined
          }
        />

        <ProfileField
          colors={colors}
          styles={styles}
          label="Rua"
          placeholder="Rua, avenida ou alameda"
          value={form.street}
          onChangeText={(value) => setFieldValue('street', value)}
          autoCapitalize="words"
        />

        <View style={styles.row}>
          <View style={styles.rowField}>
            <ProfileField
              colors={colors}
              styles={styles}
              label="Número"
              placeholder="Número"
              value={form.addressNumber}
              onChangeText={(value) => setFieldValue('addressNumber', formatAddressNumber(value))}
              keyboardType="number-pad"
              maxLength={6}
            />
          </View>

          <View style={styles.rowField}>
            <ProfileField
              colors={colors}
              styles={styles}
              label="UF"
              placeholder="SP"
              value={form.state}
              onChangeText={(value) =>
                setFieldValue('state', value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))
              }
              autoCapitalize="characters"
              maxLength={2}
              error={errors.state}
            />
          </View>
        </View>

        <ProfileField
          colors={colors}
          styles={styles}
          label="Complemento"
          placeholder="Apto, bloco, sala..."
          value={form.complement}
          onChangeText={(value) => setFieldValue('complement', value)}
          autoCapitalize="words"
        />

        <ProfileField
          colors={colors}
          styles={styles}
          label="Cidade"
          placeholder="Sua cidade"
          value={form.city}
          onChangeText={(value) => setFieldValue('city', value)}
          autoCapitalize="words"
        />

        <ProfileField
          colors={colors}
          styles={styles}
          label="Bio"
          placeholder="Conte um pouco sobre você..."
          value={form.bio}
          onChangeText={(value) => setFieldValue('bio', value.slice(0, BIO_MAX_LENGTH))}
          multiline
          numberOfLines={4}
          error={errors.bio}
          helperText={`${form.bio.length}/${BIO_MAX_LENGTH} caracteres`}
        />
      </Card>

      <Pressable
        onPress={handleSave}
        disabled={updateProfileMutation.isPending}
        style={({ pressed }) => [
          styles.saveButton,
          (pressed || updateProfileMutation.isPending) && styles.pressed,
        ]}
      >
        {updateProfileMutation.isPending ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.saveButtonText}>Salvar Alterações</Text>
        )}
      </Pressable>
    </PageShell>
  );
}

type ProfileFieldProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  error?: string;
  helperText?: string;
  trailing?: ReactNode;
  onBlur?: () => void;
  colors: AppColors;
  styles: ReturnType<typeof createStyles>;
};

function ProfileField({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  maxLength,
  editable = true,
  multiline = false,
  numberOfLines = 1,
  error,
  helperText,
  trailing,
  onBlur,
  colors,
  styles,
}: ProfileFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, !editable && styles.inputShellReadonly, error && styles.inputShellError]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onBlur={() => {
            onBlur?.();
          }}
          style={[styles.input, multiline && styles.inputMultiline]}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {trailing ? <View style={styles.inputTrailing}>{trailing}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  avatarText: {
    ...typography.h1,
    color: colors.white,
  },
  avatarHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionCard: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textSecondary,
  },
  fieldWrap: {
    gap: spacing.xs,
  },
  fieldLabel: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  inputShell: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  inputShellReadonly: {
    backgroundColor: colors.mutedSurface,
  },
  inputShellError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: colors.textPrimary,
    ...typography.body,
    paddingVertical: spacing.sm,
  },
  inputMultiline: {
    minHeight: 104,
  },
  inputTrailing: {
    marginLeft: spacing.sm,
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowField: {
    flex: 1,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  saveButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  inlineState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  inlineStateText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  noticeCard: {
    backgroundColor: colors.warningSoft,
    borderColor: '#F59E0B',
    gap: spacing.xs,
  },
  noticeTitle: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  noticeText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
});
