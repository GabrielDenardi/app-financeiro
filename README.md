# App Financeiro

Aplicativo de gestao financeira pessoal em React Native com Expo.

## Requisitos

- Node.js 20+ (LTS recomendado)
- npm 10+
- Expo Go no celular (Android/iOS) ou emulador configurado

## Primeiro setup

```bash
npm install
```

## Como iniciar o projeto

```bash
npm start
```

Isso abre o Expo Dev Tools no terminal.

## Rodar no celular

1. Instale o app **Expo Go** no celular.
2. Conecte celular e computador na mesma rede Wi-Fi.
3. Rode `npm start`.
4. Escaneie o QR code exibido no terminal.

## Rodar no Android (emulador/dispositivo)

```bash
npm run android
```

## Rodar no iOS

```bash
npm run ios
```

Observacao: no Windows, use Expo Go para iOS (sem build local).

## Rodar no navegador

```bash
npm run web
```

## Comandos principais

- `npm start`: inicia o Metro/Expo
- `npm run android`: abre no Android
- `npm run ios`: abre no iOS
- `npm run web`: abre no navegador

## Problemas comuns

- Limpar cache do Expo:

```bash
npx expo start -c
```

- Dependencias quebradas apos troca de branch:

```bash
npm install
```
