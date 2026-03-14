# App Financeiro

Aplicativo open-source de gestão financeira pessoal desenvolvido com React Native e Expo.

O objetivo do projeto é ajudar usuários a organizar suas finanças, acompanhar despesas e desenvolver consciência financeira, além de servir como um projeto educacional para desenvolvedores interessados em fintech e aplicações mobile modernas.

## Funcionalidades

- Registro de despesas e receitas
- Organização financeira pessoal
- Integração com Supabase
- Aplicativo multiplataforma (Android, iOS e Web)
- Base para futuras funcionalidades com IA para insights financeiros

## Tecnologias

- React Native
- Expo
- Supabase
- Node.js
- JavaScript / TypeScript

## Requisitos

- Node.js 20+ (LTS recomendado)
- npm 10+
- Expo Go no celular (Android/iOS) ou emulador configurado

## Primeiro setup

```bash
npm install
```

## Configuração de ambiente (Supabase)

1. Copie `.env.example` para `.env`.
2. Preencha:

```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_PRIVACY_POLICY_URL
EXPO_PUBLIC_EMAIL_REDIRECT_URL
```

3. Execute a migration SQL localizada em:

```
supabase/migrations/202602270001_auth_onboarding.sql
```

no seu projeto Supabase.

## Como iniciar o projeto

```bash
npm start
```

Isso abrirá o Expo Dev Tools no terminal.

## Rodar no celular

1. Instale o app Expo Go no celular
2. Conecte celular e computador na mesma rede Wi-Fi
3. Execute:

```bash
npm start
```

4. Escaneie o QR Code exibido no terminal.

## Rodar no Android

```bash
npm run android
```

## Rodar no iOS

```bash
npm run ios
```

Observação: no Windows utilize o Expo Go para iOS.

## Rodar no navegador

```bash
npm run web
```

## Testes

```bash
npm test
```

## Comandos principais

- `npm start` inicia o projeto
- `npm run android` abre no Android
- `npm run ios` abre no iOS
- `npm run web` abre no navegador
- `npm test` executa testes

## Problemas comuns

Limpar cache do Expo:

```bash
npx expo start -c
```

Dependências quebradas após troca de branch:

```bash
npm install
```

## Future Features

- AI-powered expense categorization
- Financial insights using AI
- Smart budgeting recommendations
- Automatic expense classification
- AI-generated financial summaries

## Contribuições

Contribuições são bem-vindas.

1. Fork do repositório
2. Crie uma branch
3. Abra um Pull Request

## Licença

Este projeto é open-source e pode ser utilizado para fins educacionais e de desenvolvimento.
