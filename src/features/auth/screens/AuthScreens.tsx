import { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { appEnv } from '../../../config/env';
import {
  AuthServiceError,
  lookupCpf,
  registerWithDraft,
  requestPasswordResetByCpf,
  resendConfirmation,
  signInWithCpf,
} from '../../../services/authService';
import { lookupAddressByCep } from '../../../services/viaCepService';
import { authTheme } from '../../../theme/authTheme';
import type { ExistingAccountInfo } from '../../../types/auth';
import type { AuthStackParamList } from '../../../navigation/types';
import { AuthButtonRow } from './AuthScreensHelpers';
import { birthCountries, brazilStates } from '../constants/locations';
import { useAuthFlow } from '../context/AuthFlowContext';
import { PrimaryButton, SecondaryButton } from '../components/AuthButton';
import { ConsentIllustration, HeroCardsIllustration, SecurityIllustration } from '../components/AuthIllustrations';
import { AuthScaffold } from '../components/AuthScaffold';
import { InlineMessage } from '../components/InlineMessage';
import { MaskedTextInput } from '../components/MaskedTextInput';
import { SelectableList } from '../components/SelectableList';
import { digitsOnly, formatAddressNumber, formatCep, formatCpf, formatDateBR, formatPhoneBR } from '../utils/masks';
import { validatePassword } from '../utils/password';
import { isAdult, isValidCep, isValidCpf, isValidEmail, isValidPhoneBR, parseDateBR } from '../utils/validation';

type ScreenProps<RouteName extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  RouteName
>;

const progressMap = {
  cpf: 0.05,
  email: 0.14,
  phone: 0.22,
  fullName: 0.3,
  birthDate: 0.38,
  birthCountry: 0.46,
  motherName: 0.54,
  cep: 0.62,
  address: 0.7,
  city: 0.76,
  state: 0.82,
  consent: 0.9,
  password: 0.97,
} as const;

function maskEmailFallback(email: string): string {
  const [localPart, domain] = email.split('@');

  if (!localPart || !domain) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }

  return `${localPart.slice(0, 2)}***${localPart.slice(-1)}@${domain}`;
}

function getReadableError(error: unknown, fallback: string): string {
  if (error instanceof AuthServiceError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function toExistingAccount(cpf: string, lookup: Awaited<ReturnType<typeof lookupCpf>>): ExistingAccountInfo {
  return {
    cpf,
    email: lookup.email ?? '',
    emailMasked: lookup.email_masked ?? (lookup.email ? maskEmailFallback(lookup.email) : ''),
    emailConfirmed: lookup.email_confirmed,
  };
}

export function WelcomeScreen({ navigation }: ScreenProps<'Welcome'>) {
  return (
    <AuthScaffold
      title="Um app financeiro sem complicacoes"
      subtitle="Controle seus gastos e investimentos com uma jornada simples e segura."
      scrollable={false}
      footer={<PrimaryButton title="Comecar" onPress={() => navigation.navigate('Cpf')} />}
    >
      <View style={styles.welcomeContent}>
        <HeroCardsIllustration />
      </View>
    </AuthScaffold>
  );
}

export function CpfScreen({ navigation }: ScreenProps<'Cpf'>) {
  const { draft, mergeDraft, setExistingAccount } = useAuthFlow();
  const [cpf, setCpf] = useState(formatCpf(draft.cpf));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    const cpfDigits = digitsOnly(cpf);

    if (!isValidCpf(cpfDigits)) {
      setError('CPF invalido. Confira os numeros e tente novamente.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const lookup = await lookupCpf(cpfDigits);
      mergeDraft({ cpf: cpfDigits });

      if (lookup.account_exists && lookup.email) {
        setExistingAccount(toExistingAccount(cpfDigits, lookup));
        navigation.navigate('ExistingPassword');
        return;
      }

      setExistingAccount(null);
      navigation.navigate('RegisterEmail');
    } catch (lookupError) {
      setError(getReadableError(lookupError, 'Nao foi possivel validar o CPF agora.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Boas-vindas! Qual o seu CPF?"
      subtitle="Precisamos dele para iniciar o cadastro ou acessar o aplicativo."
      progress={progressMap.cpf}
      onBack={() => navigation.goBack()}
      footer={<PrimaryButton title="Continuar" onPress={handleContinue} loading={isLoading} />}
    >
      <MaskedTextInput
        placeholder="000.000.000-00"
        value={cpf}
        onChangeText={(value) => {
          setCpf(formatCpf(value));
          setError(null);
        }}
        keyboardType="number-pad"
        maxLength={14}
        error={error}
        helperText="Somente seu CPF para identificar se voce ja tem conta."
      />
    </AuthScaffold>
  );
}

export function ExistingPasswordScreen({ navigation }: ScreenProps<'ExistingPassword'>) {
  const { existingAccount } = useAuthFlow();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  if (!existingAccount) {
    return (
      <AuthScaffold
        title="Conta nao identificada"
        subtitle="Volte e informe seu CPF para continuar."
        onBack={() => navigation.goBack()}
        footer={<PrimaryButton title="Voltar ao CPF" onPress={() => navigation.navigate('Cpf')} />}
      >
        <InlineMessage message="Nao encontramos dados de conta para esta etapa." variant="error" />
      </AuthScaffold>
    );
  }

  const handleSignIn = async () => {
    if (!password.trim()) {
      setError('Digite sua senha para entrar.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfo(null);

    try {
      await signInWithCpf(existingAccount.cpf, password);
    } catch (signInError) {
      if (signInError instanceof AuthServiceError && signInError.code === 'email_not_confirmed') {
        setError(signInError.message);
        setInfo('Reenvie o e-mail de confirmacao para liberar o acesso.');
      } else {
        setError(getReadableError(signInError, 'Nao foi possivel entrar agora.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setIsResetting(true);
    setError(null);
    setInfo(null);

    try {
      await requestPasswordResetByCpf(existingAccount.cpf);
      setInfo(`Enviamos um link de redefinicao para ${existingAccount.emailMasked}.`);
    } catch (resetError) {
      setError(getReadableError(resetError, 'Nao foi possivel enviar a redefinicao.'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleResendConfirmation = async () => {
    setIsResending(true);
    setError(null);
    setInfo(null);

    try {
      await resendConfirmation(existingAccount.email);
      setInfo(`Enviamos um novo e-mail de confirmacao para ${existingAccount.emailMasked}.`);
    } catch (resendError) {
      setError(getReadableError(resendError, 'Nao foi possivel reenviar o e-mail.'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthScaffold
      title="Esta conta ja existe"
      subtitle={`Ja existe uma conta com este CPF. Digite sua senha para entrar (${existingAccount.emailMasked}).`}
      onBack={() => navigation.goBack()}
      footer={
        <AuthButtonRow>
          <SecondaryButton
            title="Esqueci a senha"
            onPress={handleResetPassword}
            loading={isResetting}
            style={styles.rowButton}
          />
          <PrimaryButton title="Entrar" onPress={handleSignIn} loading={isLoading} style={styles.rowButton} />
        </AuthButtonRow>
      }
    >
      <MaskedTextInput
        placeholder="Digite sua senha"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setError(null);
        }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        error={error}
      />

      {info ? <InlineMessage variant="info" message={info} /> : null}

      <Pressable
        onPress={handleResendConfirmation}
        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
      >
        <Text style={styles.linkButtonText}>
          Reenviar e-mail de confirmacao
          {isResending ? '...' : ''}
        </Text>
      </Pressable>
    </AuthScaffold>
  );
}

export function RegisterEmailScreen({ navigation }: ScreenProps<'RegisterEmail'>) {
  const { draft, setField } = useAuthFlow();
  const [email, setEmail] = useState(draft.email);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      setError('Digite um e-mail valido.');
      return;
    }

    setField('email', normalizedEmail);
    navigation.navigate('RegisterPhone');
  };

  return (
    <AuthScaffold
      title="Qual o seu e-mail?"
      subtitle="Essa sera sua principal forma de comunicacao."
      progress={progressMap.email}
      onBack={() => navigation.goBack()}
      footer={<PrimaryButton title="Continuar" onPress={handleContinue} />}
    >
      <MaskedTextInput
        placeholder="seuemail@provedor.com"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setError(null);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        error={error}
      />
    </AuthScaffold>
  );
}

export function RegisterPhoneScreen({ navigation }: ScreenProps<'RegisterPhone'>) {
  const { draft, setField } = useAuthFlow();
  const [phone, setPhone] = useState(formatPhoneBR(draft.phone));
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    const phoneDigits = digitsOnly(phone);

    if (!isValidPhoneBR(phoneDigits)) {
      setError('Digite um celular com DDD e 9 digitos.');
      return;
    }

    setField('phone', phoneDigits);
    navigation.navigate('RegisterFullName');
  };

  return (
    <AuthScaffold
      title="Qual o numero do seu celular?"
      subtitle="Digite o numero com DDD."
      progress={progressMap.phone}
      onBack={() => navigation.goBack()}
      footer={<PrimaryButton title="Continuar" onPress={handleContinue} />}
    >
      <MaskedTextInput
        placeholder="(00) 00000-0000"
        value={phone}
        onChangeText={(value) => {
          setPhone(formatPhoneBR(value));
          setError(null);
        }}
        keyboardType="number-pad"
        maxLength={15}
        error={error}
      />
    </AuthScaffold>
  );
}

export function RegisterFullNameScreen({ navigation }: ScreenProps<'RegisterFullName'>) {
  const { draft, setField } = useAuthFlow();
  const [fullName, setFullName] = useState(draft.fullName);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    const normalized = fullName.trim().replace(/\s+/g, ' ');

    if (normalized.split(' ').length < 2) {
      setError('Informe nome e sobrenome.');
      return;
    }

    setField('fullName', normalized);
    navigation.navigate('RegisterBirthDate');
  };

  return (
    <AuthScaffold
      title="Qual seu nome completo?"
      progress={progressMap.fullName}
      onBack={() => navigation.goBack()}
      footer={<PrimaryButton title="Continuar" onPress={handleContinue} />}
    >
      <MaskedTextInput
        placeholder="Nome e sobrenome"
        value={fullName}
        onChangeText={(value) => {
          setFullName(value);
          setError(null);
        }}
        autoCapitalize="words"
        autoCorrect={false}
        error={error}
      />
    </AuthScaffold>
  );
}

export function RegisterBirthDateScreen({ navigation }: ScreenProps<'RegisterBirthDate'>) {
  const { draft, setField } = useAuthFlow();
  const [birthDate, setBirthDate] = useState(formatDateBR(draft.birthDate));
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    const parsed = parseDateBR(birthDate);

    if (!parsed) {
      setError('Digite uma data valida no formato dd/mm/aaaa.');
      return;
    }

    if (!isAdult(parsed, 18)) {
      setError('Voce precisa ter pelo menos 18 anos para continuar.');
      return;
    }

    setField('birthDate', birthDate);
    navigation.navigate('RegisterBirthCountry');
  };

  return (
    <AuthScaffold
      title="Qual a data do seu nascimento?"
      progress={progressMap.birthDate}
      onBack={() => navigation.goBack()}
      footer={<PrimaryButton title="Continuar" onPress={handleContinue} />}
    >
      <MaskedTextInput
        placeholder="dd/mm/aaaa"
        value={birthDate}
        onChangeText={(value) => {
          setBirthDate(formatDateBR(value));
          setError(null);
        }}
        keyboardType="number-pad"
        maxLength={10}
        error={error}
      />
    </AuthScaffold>
  );
}

export function RegisterBirthCountryScreen({ navigation }: ScreenProps<'RegisterBirthCountry'>) {
  const { draft, setField } = useAuthFlow();
  const items = useMemo(
    () => birthCountries.map((country) => ({ label: country, value: country })),
    [],
  );
  const selectedValue = draft.birthCountry || 'Brasil';

  return (
    <AuthScaffold
      title="Escolha o pais onde voce nasceu"
      progress={progressMap.birthCountry}
      onBack={() => navigation.goBack()}
      footer={
        <PrimaryButton
          title="Continuar"
          onPress={() => navigation.navigate('RegisterMotherName')}
        />
      }
      scrollable={false}
    >
      <SelectableList
        items={items}
        selectedValue={selectedValue}
        onSelect={(value) => setField('birthCountry', value)}
        searchPlaceholder="Buscar pais"
      />
    </AuthScaffold>
  );
}

export function RegisterMotherNameScreen({ navigation }: ScreenProps<'RegisterMotherName'>) {
  const { draft, setField } = useAuthFlow();
  const [motherName, setMotherName] = useState(draft.motherName);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    const normalized = motherName.trim().replace(/\s+/g, ' ');

    if (normalized.length < 3) {
      setError('Informe o nome completo da sua mae.');
      return;
    }

    setField('motherName', normalized);
    navigation.navigate('RegisterCep');
  };

  return (
    <AuthScaffold
      title="Qual o nome completo da sua mae?"
      subtitle='Se nao houver registro, digite "nome ausente".'
      progress={progressMap.motherName}
      onBack={() => navigation.goBack()}
      footer={<PrimaryButton title="Continuar" onPress={handleContinue} />}
    >
      <MaskedTextInput
        placeholder="Nome da mae"
        value={motherName}
        onChangeText={(value) => {
          setMotherName(value);
          setError(null);
        }}
        autoCapitalize="words"
        autoCorrect={false}
        error={error}
      />
    </AuthScaffold>
  );
}

export function RegisterCepScreen({ navigation }: ScreenProps<'RegisterCep'>) {
  const { draft, mergeDraft } = useAuthFlow();
  const [cep, setCep] = useState(formatCep(draft.cep));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    const cepDigits = digitsOnly(cep);

    if (!isValidCep(cepDigits)) {
      setError('Digite um CEP valido com 8 digitos.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfo(null);

    try {
      const address = await lookupAddressByCep(cepDigits);
      mergeDraft({
        cep: cepDigits,
        street: address?.street || draft.street,
        city: address?.city || draft.city,
        state: address?.state || draft.state,
      });

      if (!address) {
        setInfo('Nao foi possivel preencher automaticamente. Continue com preenchimento manual.');
      }

      navigation.navigate('RegisterAddress');
    } catch (lookupError) {
      setError(getReadableError(lookupError, 'Nao foi possivel buscar o CEP.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Qual o CEP do seu endereco?"
      progress={progressMap.cep}
      onBack={() => navigation.goBack()}
      footer={<PrimaryButton title="Continuar" onPress={handleContinue} loading={isLoading} />}
    >
      <MaskedTextInput
        placeholder="00000-000"
        value={cep}
        onChangeText={(value) => {
          setCep(formatCep(value));
          setError(null);
          setInfo(null);
        }}
        keyboardType="number-pad"
        maxLength={9}
        error={error}
      />
      {info ? <InlineMessage variant="info" message={info} /> : null}
    </AuthScaffold>
  );
}

export function RegisterAddressScreen({ navigation }: ScreenProps<'RegisterAddress'>) {
  const { draft, mergeDraft } = useAuthFlow();
  const [street, setStreet] = useState(draft.street);
  const [addressNumber, setAddressNumber] = useState(draft.addressNumber);
  const [complement, setComplement] = useState(draft.complement);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    const normalizedStreet = street.trim();
    const normalizedNumber = digitsOnly(addressNumber);

    if (!normalizedStreet) {
      setError('Informe a rua, avenida ou alameda.');
      return;
    }

    if (normalizedNumber.length === 0 || normalizedNumber.length > 6) {
      setError('Digite um numero de endereco com ate 6 digitos.');
      return;
    }

    mergeDraft({
      street: normalizedStreet,
      addressNumber: normalizedNumber,
      complement: complement.trim(),
    });
    navigation.navigate('RegisterCity');
  };

  return (
    <AuthScaffold
      title="Confirme seu endereco"
      subtitle="Ajuste os dados antes de continuar."
      progress={progressMap.address}
      onBack={() => navigation.goBack()}
      footer={<PrimaryButton title="Continuar" onPress={handleContinue} />}
    >
      <MaskedTextInput
        label="Endereco"
        placeholder="Rua, Avenida, Alameda..."
        value={street}
        onChangeText={(value) => {
          setStreet(value);
          setError(null);
        }}
        autoCapitalize="words"
        autoCorrect={false}
        inputStyle={styles.compactInput}
      />
      <MaskedTextInput
        label="Numero do endereco"
        placeholder="Numero"
        value={addressNumber}
        onChangeText={(value) => {
          setAddressNumber(formatAddressNumber(value));
          setError(null);
        }}
        keyboardType="number-pad"
        maxLength={6}
        inputStyle={styles.compactInput}
      />
      <MaskedTextInput
        label="Complemento (opcional)"
        placeholder="Apto, bloco, sala..."
        value={complement}
        onChangeText={setComplement}
        autoCapitalize="words"
        autoCorrect={false}
        inputStyle={styles.compactInput}
      />
      {error ? <InlineMessage message={error} /> : null}
    </AuthScaffold>
  );
}

export function RegisterCityScreen({ navigation }: ScreenProps<'RegisterCity'>) {
  const { draft, setField } = useAuthFlow();
  const [city, setCity] = useState(draft.city);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    const normalized = city.trim();

    if (!normalized) {
      setError('Informe sua cidade.');
      return;
    }

    if (normalized.length > 50) {
      setError('A cidade deve ter ate 50 caracteres.');
      return;
    }

    setField('city', normalized);
    navigation.navigate('RegisterState');
  };

  return (
    <AuthScaffold
      title="Confirme sua cidade"
      progress={progressMap.city}
      onBack={() => navigation.goBack()}
      footer={<PrimaryButton title="Continuar" onPress={handleContinue} />}
    >
      <MaskedTextInput
        placeholder="Cidade"
        value={city}
        onChangeText={(value) => {
          setCity(value);
          setError(null);
        }}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={50}
        error={error}
      />
    </AuthScaffold>
  );
}

export function RegisterStateScreen({ navigation }: ScreenProps<'RegisterState'>) {
  const { draft, setField } = useAuthFlow();
  const items = useMemo(() => brazilStates.map((state) => ({ label: state, value: state })), []);
  const [selectedState, setSelectedState] = useState(draft.state || 'RJ');

  return (
    <AuthScaffold
      title="Confirme seu estado"
      progress={progressMap.state}
      onBack={() => navigation.goBack()}
      footer={
        <PrimaryButton
          title="Continuar"
          onPress={() => {
            setField('state', selectedState);
            navigation.navigate('RegisterConsent');
          }}
        />
      }
      scrollable={false}
    >
      <SelectableList
        items={items}
        selectedValue={selectedState}
        onSelect={setSelectedState}
        searchPlaceholder="Buscar UF"
      />
    </AuthScaffold>
  );
}

export function RegisterConsentScreen({ navigation }: ScreenProps<'RegisterConsent'>) {
  const { setField } = useAuthFlow();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    if (!accepted) {
      setError('Voce precisa aceitar os termos para continuar.');
      return;
    }

    setField('consentAccepted', true);
    navigation.navigate('RegisterPassword');
  };

  return (
    <AuthScaffold
      title="Falta pouco para concluir"
      subtitle="Ao enviar, voce declara que leu e concorda com as condicoes de tratamento de dados pessoais."
      progress={progressMap.consent}
      onBack={() => navigation.goBack()}
      footer={<PrimaryButton title="Aceitar e continuar" onPress={handleContinue} />}
    >
      <View style={styles.centeredIllustration}>
        <ConsentIllustration />
      </View>

      <Pressable
        onPress={() => {
          setAccepted((current) => !current);
          setError(null);
        }}
        style={({ pressed }) => [
          styles.checkboxRow,
          accepted && styles.checkboxRowActive,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.checkbox, accepted && styles.checkboxActive]} />
        <Text style={styles.checkboxText}>Li e concordo com os termos e condicoes.</Text>
      </Pressable>

      <Pressable
        onPress={() => {
          if (!appEnv.privacyPolicyUrl) {
            setError(
              'Defina EXPO_PUBLIC_PRIVACY_POLICY_URL para abrir a politica de privacidade.',
            );
            return;
          }

          Linking.openURL(appEnv.privacyPolicyUrl).catch(() => {
            setError('Nao foi possivel abrir a politica de privacidade.');
          });
        }}
        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
      >
        <Text style={styles.linkButtonText}>Ler politica de privacidade</Text>
      </Pressable>

      {error ? <InlineMessage message={error} /> : null}
    </AuthScaffold>
  );
}

export function RegisterPasswordScreen({ navigation }: ScreenProps<'RegisterPassword'>) {
  const { draft, mergeDraft, resetDraft, setExistingAccount } = useAuthFlow();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    const passwordValidationError = validatePassword(password);
    if (passwordValidationError) {
      setError(passwordValidationError);
      return;
    }

    setIsLoading(true);
    setError(null);
    setInfo(null);

    try {
      mergeDraft({ password });
      await registerWithDraft({ ...draft, password });
      setExistingAccount(null);
      navigation.navigate('EmailConfirmation', { email: draft.email });
      resetDraft();
    } catch (registerError) {
      setError(getReadableError(registerError, 'Nao foi possivel concluir seu cadastro agora.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Crie uma senha para entrar"
      subtitle="Minimo de 8 caracteres, com letras e numeros, evitando sequencias."
      progress={progressMap.password}
      onBack={() => navigation.goBack()}
      footer={<PrimaryButton title="Concluir cadastro" onPress={handleContinue} loading={isLoading} />}
    >
      <View style={styles.centeredIllustration}>
        <SecurityIllustration />
      </View>
      <MaskedTextInput
        placeholder="Digite sua senha"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setError(null);
          setInfo(null);
        }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        error={error}
      />
      <InlineMessage
        variant="info"
        message="Dica: combine letras e numeros e evite repeticoes ou sequencias previsiveis."
      />
      {info ? <InlineMessage variant="success" message={info} /> : null}
    </AuthScaffold>
  );
}

export function EmailConfirmationScreen({
  navigation,
  route,
}: ScreenProps<'EmailConfirmation'>) {
  const email = route.params.email;
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenEmail = () => {
    Linking.openURL(`mailto:${email}`).catch(() => {
      setError('Nao foi possivel abrir seu aplicativo de e-mail.');
    });
  };

  const handleResend = async () => {
    setIsLoading(true);
    setError(null);
    setInfo(null);

    try {
      await resendConfirmation(email);
      setInfo('Novo e-mail de confirmacao enviado com sucesso.');
    } catch (resendError) {
      setError(getReadableError(resendError, 'Nao foi possivel reenviar o e-mail.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthScaffold
      title="Confirme seu e-mail"
      subtitle={`Abra sua caixa de entrada e valide a mensagem enviada para ${email}.`}
      onBack={() => navigation.navigate('Cpf')}
      footer={
        <View style={styles.footerColumn}>
          <PrimaryButton title="Abrir app de e-mail" onPress={handleOpenEmail} />
          <SecondaryButton
            title="Ja confirmei o e-mail"
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Cpf' }] })}
          />
        </View>
      }
    >
      <InlineMessage
        variant="info"
        message="A confirmacao pode levar alguns minutos. Se necessario, solicite novo envio."
      />
      <Pressable onPress={handleResend} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
        <Text style={styles.linkButtonText}>
          {isLoading ? 'Reenviando e-mail...' : 'Nao recebi o e-mail'}
        </Text>
      </Pressable>
      <Pressable
        onPress={() => navigation.navigate('RegisterEmail')}
        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
      >
        <Text style={styles.linkButtonText}>Meu e-mail esta errado</Text>
      </Pressable>
      {info ? <InlineMessage variant="success" message={info} /> : null}
      {error ? <InlineMessage message={error} /> : null}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  welcomeContent: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 20,
  },
  linkButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  linkButtonText: {
    color: authTheme.colors.brand,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  compactInput: {
    fontSize: 20,
    minHeight: 44,
  },
  centeredIllustration: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  checkboxRow: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: authTheme.colors.border,
    backgroundColor: authTheme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
  },
  checkboxRowActive: {
    borderColor: authTheme.colors.brand,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#C9BDDA',
  },
  checkboxActive: {
    backgroundColor: authTheme.colors.brand,
    borderColor: authTheme.colors.brand,
  },
  checkboxText: {
    flex: 1,
    color: authTheme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  footerColumn: {
    gap: 10,
  },
  rowButton: {
    flex: 1,
  },
});
