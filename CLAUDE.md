# app-financeiro — Documentação do Projeto

## Visão Geral

Aplicativo de **controle de finanças pessoais** desenvolvido com React Native (Expo) e Supabase. Permite gerenciar contas bancárias, transações, cartões de crédito, orçamentos, metas, recorrências e despesas compartilhadas em grupo. O lançamento inicial é Android pela Google Play.

- Todo o app é em **português brasileiro (pt-BR)** — sem biblioteca de i18n; strings hardcoded.
- Modelo **freemium** com plano Free gratuito (padrão no cadastro) + 3 planos pagos (basic / intermediate / pro) cobrados pelo **Google Play Billing**, com RevenueCat.
- Recursos avançados: captura de transação por **voz** e por **OCR de comprovantes** (OpenAI via Edge Functions), importação de extratos XLSX/CSV, lock biométrico, exportação de dados (LGPD).

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | React Native 0.81 + Expo ~54 |
| Linguagem | TypeScript 5.9 (strict mode) |
| UI/React | React 19.1 |
| Navegação | React Navigation 7 (native-stack + bottom-tabs) |
| Data fetching | TanStack React Query 5 |
| Backend | Supabase (PostgreSQL + Auth + Storage + Edge Functions Deno) |
| Cliente Supabase | @supabase/supabase-js ^2 |
| Ícones | Lucide React Native |
| Gráficos | react-native-gifted-charts |
| Datas | date-fns 4 + Intl (pt-BR) |
| Planilhas | xlsx (importação de extratos) |
| Biometria | expo-local-authentication |
| Storage local | AsyncStorage + expo-secure-store |
| Pagamentos | Google Play Billing + RevenueCat |
| IA | OpenAI (OCR e transcrição de voz, nas Edge Functions) |
| Testes | Jest + jest-expo + @testing-library/react-native |

Não há ESLint/Prettier configurados no projeto.

---

## Comandos de Desenvolvimento

```bash
npm install            # Instalar dependências (Node 20+, npm 10+)

npm start              # Servidor de desenvolvimento Expo
npm run android        # Rodar no Android
npm run ios            # Rodar no iOS
npm run web            # Rodar no navegador

npm test               # Rodar testes (Jest)

npx expo start -c      # Limpar cache do bundler
```

**Migrations:** os arquivos SQL em `supabase/migrations/` (numerados por timestamp) são aplicados **manualmente** no painel/CLI do Supabase — não há pipeline automático.

---

## Estrutura de Diretórios

```text
app-financeiro/
├── App.tsx                    # Root: QueryClientProvider + AppThemeProvider + Navigation
├── index.ts                   # Entry point (registerRootComponent)
├── app.json                   # Config Expo (plugins: image-picker, local-auth, audio, etc.)
├── jest.config.js / jest.setup.ts
├── src/
│   ├── components/            # Componentes compartilhados (Card, PageHeader, PageShell,
│   │                          #   BalanceCard, TransactionListItem, MonthlyBarChart,
│   │                          #   FloatingActionButton, modais de conta/cartão/transferência)
│   ├── config/
│   │   └── env.ts             # Carregamento e sanitização das variáveis de ambiente
│   ├── data/                  # Dados mock para desenvolvimento
│   ├── features/              # Organização POR FEATURE (padrão principal do projeto)
│   │   ├── accounts/          # Contas bancárias e transferências
│   │   ├── auth/              # Telas, contexto e validações do fluxo de autenticação
│   │   ├── billing/           # Google Play Billing via RevenueCat
│   │   ├── budgets/           # Orçamentos mensais por categoria
│   │   ├── cards/             # Cartões de crédito, faturas e parcelas
│   │   ├── dashboard/         # Dados da Home
│   │   ├── finance/           # queryKeys.ts (factory de query keys) + utils financeiros
│   │   ├── goals/             # Metas financeiras
│   │   ├── groups/            # Despesas compartilhadas em grupo
│   │   ├── help/              # Central de ajuda/FAQ
│   │   ├── imports/           # Importação XLSX/CSV
│   │   ├── incomeTax/         # Relatório de imposto de renda
│   │   ├── notifications/     # Notificações do usuário
│   │   ├── plans/             # Planos de assinatura e entitlements
│   │   ├── preferences/       # Preferências do usuário + biometria
│   │   ├── profile/           # Perfil do usuário
│   │   ├── recurring/         # Transações recorrentes
│   │   ├── reports/           # Relatórios financeiros
│   │   ├── support/           # Chat de suporte
│   │   └── transactions/      # Transações + captura por voz/OCR
│   ├── lib/
│   │   ├── supabase.ts        # Inicialização do cliente Supabase
│   │   ├── auth.ts            # getCurrentUserId(), requireCurrentUserId()
│   │   └── authRedirect.ts    # Tratamento de deep link de callback
│   ├── navigation/
│   │   ├── RootNavigator.tsx  # Máquina de estados: sessão + lock biométrico + plan gate
│   │   ├── AppStack.tsx       # Rotas autenticadas
│   │   ├── AppTabs.tsx        # Bottom tabs (Home, Transactions, Goals, Budget, Settings)
│   │   ├── AuthStack.tsx      # Rotas de autenticação/cadastro
│   │   └── types.ts           # Tipos de params de navegação
│   ├── screens/               # Telas completas (HomeScreen, AccountsScreen, CardsScreen,
│   │                          #   BudgetScreen, GoalsScreen, ReportScreen, ImportScreen,
│   │                          #   IncomeTaxScreen, MenuScreen, LockScreen, PlansScreen, etc.)
│   ├── services/              # Serviços globais (authService, viaCepService)
│   ├── theme/                 # Design system (colors, typography, spacing, radius, layout,
│   │                          #   AppThemeProvider)
│   ├── types/                 # Tipos globais (auth, finance, groups, profile, notifications)
│   └── utils/                 # format.ts (moeda/data pt-BR), notificationsStorage.ts
└── supabase/
    ├── migrations/            # Schema SQL numerado por timestamp (aplicação manual)
    └── functions/             # Edge Functions (Deno)
```

**Cada feature** segue a estrutura: `hooks/` (React Query), `services/` (chamadas Supabase), `types/`, e opcionalmente `screens/`, `components/`, `utils/`, `__tests__/`.

---

## Funcionalidades (Domínio)

| Feature | Descrição |
|---|---|
| Contas | Conta corrente, poupança, investimento, dinheiro; saldo inicial + saldo atual calculado por view |
| Transações | Receitas/despesas com categoria e meio de pagamento (Pix, Transferência, Dinheiro, Cartão crédito/débito, Boleto); origem manual, voz, OCR, importação, transferência, grupo, etc. (`sourceType`) |
| Cartões de crédito | Limite, dia de fechamento e vencimento, faturas mensais, compras parceladas em até **24x**, pagamento de fatura debitando uma conta |
| Orçamentos | Limite mensal por categoria com progresso de gasto (`v_budget_progress`) |
| Metas | Metas de poupança com valor inicial + aportes (`goal_contributions`) e progresso |
| Recorrências | Regras mensais de receita/despesa com flag `isVariable` para valores que mudam por mês |
| Transferências | Entre contas próprias, com trilha de auditoria (`account_transfers`) |
| Grupos | Despesas compartilhadas: membros (admin/member), splits (equal/percentage/custom), acertos (settlements PIX/Dinheiro/Transferência), código de convite de 6 caracteres |
| Relatórios | Por categoria, meio de pagamento, taxa de poupança, fluxo semanal (buckets S1–S5) |
| Imposto de renda | Relatório anual por seção (rendimentos, dedutíveis, outras) + comprovantes |
| Importação | XLSX/CSV em lote com fingerprint para detecção de duplicatas (`import_batches`) |
| Captura voz/OCR | Áudio transcrito e imagem de comprovante interpretados por OpenAI via Edge Functions |
| Notificações | Lista de notificações do usuário (`user_notifications`) |
| Suporte | Chat de suporte (exclusivo do plano Pro) — integração parcialmente concluída |
| Ajuda | Categorias e artigos de FAQ vindos do banco |
| Preferências | Tema claro/escuro, lock biométrico, eventos de login, exportação de dados |

---

## Navegação

`RootNavigator.tsx` é uma **máquina de estados** que combina três dimensões:

- `AuthSessionState`: `loading | authenticated | unauthenticated`
- `AppUnlockState`: `locked | checking | unlocked` — com o lock ativado, o app **bloqueia ao ir para background** e o `LockScreen` dispara a biometria automaticamente (com fallback para o PIN do aparelho); **nunca desbloqueia sem autenticação**. A decisão de bloquear usa apenas o flag local no SecureStore (sem rede).
- `PlanGateState`: `checking | ready` — perfis sem plano recebem automaticamente o plano **Free** (RPC `select_free_plan`); não há mais tela obrigatória de escolha de plano

```text
RootNavigator
├── AuthStack (não autenticado)
│   Welcome → Cpf → ExistingPassword (login)
│   ou fluxo de cadastro em ~14 etapas:
│   RegisterEmail → Phone → FullName → BirthDate → BirthCountry → MotherName
│   → Cep → Address → City → State → Consent → Password → EmailConfirmation
└── AppStack (autenticado)
    ├── MainTabs: Home | Transactions | Goals | Budget | Settings (MenuScreen)
    └── Telas em stack: Accounts, Cards, Reports, Import, IncomeTax, Groups,
        GroupDetails, RecurringTransactions, Plans, Notifications, Help,
        Privacy, About, EditProfile, ListChat/Chat
```

---

## Autenticação

- **Supabase Auth** com onboarding baseado em **CPF**: o login começa pela busca de CPF (RPC `lookup_account_by_cpf`), seguida de senha (conta existente) ou cadastro multi-etapas.
- Confirmação de e-mail via deep link `appfinanceiro://auth/callback` (tratado em `src/lib/authRedirect.ts`).
- Recuperação de senha também por CPF (envia link por e-mail).
- **Lock biométrico** (digital/Face ID) via `expo-local-authentication`; toggle em `features/preferences/services/biometricService.ts`.
- Estado do formulário de cadastro: `features/auth/context/AuthFlowContext.tsx`.
- Operações de auth: `src/services/authService.ts` (lookupCpf, signInWithCpf, registerWithDraft, resendConfirmation, requestPasswordResetByCpf, updatePassword). Erros mapeados para `AuthServiceError` com mensagens em pt-BR.
- **Nos services, sempre usar `requireCurrentUserId()`** de `src/lib/auth.ts` — lança erro se não autenticado.

---

## Banco de Dados (Supabase)

Cliente inicializado em `src/lib/supabase.ts` — storage adaptativo: AsyncStorage (nativo), localStorage (web), Map em memória (fallback). `autoRefreshToken` e `persistSession` habilitados.

**RLS habilitado em todas as tabelas** — isolamento por `auth.uid()`.

### Principais tabelas (por domínio)

| Domínio | Tabelas |
|---|---|
| Perfil/Auth | `profiles`, `auth_login_events`, `user_preferences`, `data_export_requests`, `account_deletion_requests` |
| Finanças core | `personal_accounts`, `personal_transactions`, `financial_categories`, `account_transfers`, `recurring_transaction_rules`, `recurring_transaction_executions` |
| Metas/Orçamento | `financial_goals`, `goal_contributions`, `budget_plans` |
| Cartões | `credit_cards`, `credit_card_charges`, `credit_card_installments` |
| Grupos | `groups`, `group_members`, `group_splits`, `group_split_shares`, `group_settlements` |
| Importação | `import_batches`, `import_batch_rows` |
| Anexos | `transaction_attachments` (comprovantes OCR/voz, recibos de grupo) |
| Conteúdo | `help_categories`, `help_articles`, `help_article_steps`, `app_content_blocks`, `app_external_links` |
| Suporte | `support_conversations`, `support_messages` |
| Notificações | `user_notifications` |
| Billing | `billing_provider_events` + tabelas legadas da AbacatePay |

### Views

- `v_account_current_balance` — saldo atual calculado a partir das transações
- `v_card_invoice_summary` — agregação mensal das faturas de cartão
- `v_card_installment_feed` — feed de parcelas de cartão
- `v_budget_progress` — orçado × gasto no mês
- `v_goal_progress` — progresso das metas

### RPCs relevantes

`lookup_account_by_cpf`, `ensure_default_personal_account`, `select_free_plan` (ativa o plano Free para o usuário logado), `record_card_charge` (cria parcelas com arredondamento em centavos), `compute_card_invoice_month` / `compute_card_due_date`, `create_group`, `join_group_by_code`, `create_group_split`, `request_group_settlement`, `confirm_group_settlement`, `group_outstanding_amount`.

### Regras de negócio importantes no schema

- Datas de mês (faturas, orçamentos) são sempre o **dia 1 do mês** (`YYYY-MM-01`).
- Fatura do cartão: mês calculado de `purchase_date` × `closing_day`; vencimento = mês da fatura + `due_day`.
- Parcelas: valor total dividido igualmente, última parcela ajustada pelo arredondamento.

---

## Edge Functions (Deno — `supabase/functions/`)

| Função | Descrição |
|---|---|
| `parse-transaction-ocr` | Extrai transação de imagem de comprovante (OpenAI vision) |
| `parse-transaction-voice` | Transcreve áudio e interpreta a transação (OpenAI) |
| `sync-revenuecat-subscription` | Confere o estado atual da assinatura autenticada |
| `revenuecat-webhook` | Sincroniza eventos da Google Play recebidos pelo RevenueCat |
| `export-user-data` | Exportação de dados do usuário (LGPD) |
| `delete-user-account` | Exclusão de conta (LGPD) |

Utilitários compartilhados ficam em `supabase/functions/_shared/`. As funções chamadas pelo app exigem JWT; `revenuecat-webhook` desabilita a verificação JWT da plataforma e valida seu próprio Bearer token secreto.

---

## Variáveis de Ambiente

No app (`.env`, prefixo `EXPO_PUBLIC_` exposto ao cliente):

```dotenv
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_PRIVACY_POLICY_URL
EXPO_PUBLIC_EMAIL_REDIRECT_URL      # appfinanceiro://auth/callback
EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY
```

Nas Edge Functions (secrets do Supabase, nunca no cliente):

```dotenv
OPENAI_API_KEY / OPENAI_OCR_MODEL / OPENAI_PARSER_MODEL / OPENAI_TRANSCRIBE_MODEL
RESEND_API_KEY / RESEND_FROM_EMAIL
REVENUECAT_SECRET_API_KEY / REVENUECAT_WEBHOOK_AUTH_TOKEN
```

Carregamento/sanitização em `src/config/env.ts`.

---

## Planos de Assinatura

Definidos em `src/features/plans/plans.ts`; entitlements verificados via hooks da mesma feature. Plano armazenado em `profiles.subscription_plan`.

| Plano | Contas | Recursos |
|---|---|---|
| `free` | 1 | **Padrão no cadastro (sem checkout).** Apenas Dashboard, cadastro de receitas/despesas, perfil e tela de planos — todas as demais features exibem paywall |
| `basic` | 1 | Relatórios parciais; sem grupos, sem captura por voz |
| `intermediate` | 2 | Relatórios completos, criação de grupos, captura por voz |
| `pro` | 4 | Tudo + chat de suporte, importação/exportação de dados, exportação para IR |

O bloqueio de telas para o plano Free é feito pelo componente `PremiumGate` (`src/features/plans/components/PremiumGate.tsx`), aplicado nas rotas em `AppTabs.tsx` e `AppStack.tsx` — exibe paywall com CTA para a tela de planos. Voltar para o Free usa a RPC `select_free_plan` via `src/features/plans/services/plansService.ts`.

---

## Sistema de Design

Tokens em `src/theme/` — **sempre usar os tokens, nunca valores hardcoded**. Acesso via `useAppTheme()` / `useThemeColors()` do `AppThemeProvider`. Tema (claro/escuro) persistido em AsyncStorage com a chave `app-financeiro:theme-mode`.

Paleta da marca **nitin** (ver `assets/brand/` e o PDF de identidade): Abyss `#02040C` · Midnight `#0330B0` · Sapphire `#0A3FD4` · Electric `#1D60F5` · White `#FFFFFF`.

| Token | Light | Dark |
|---|---|---|
| `primary` | `#0330B0` | `#0A3FD4` |
| `primaryLight` | `#1D60F5` | `#1D60F5` |
| `success` | `#16A34A` | `#16A34A` |
| `danger` | `#DC2626` | `#DC2626` |
| `background` | `#F8FAFC` | `#02040C` |
| `surface` | `#FFFFFF` | `#0B1226` |
| `textPrimary` | `#0F172A` | `#E2E8F0` |
| `textSecondary` | `#64748B` | `#94A3B8` |
| `border` | `#E2E8F0` | `#1B2547` |

Variantes "soft" para fundos de status: `primarySoft`, `successSoft`, `dangerSoft`, `warningSoft`.

**Tipografia** (`typography.ts`): `h1` 24/700, `h2` 18/600, `h3` 14/500, `body` 14/400, `caption` 12/400, `value` 20/700 (valores monetários).

**Spacing** (`spacing.ts`): xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32.
**Radius** (`radius.ts`): sm 8 · md 12 · lg 16 · pill 999.
**Layout** (`layout.ts`): `pageHorizontal` 16, `pageSectionGap` 16, `pageHeaderTop` 56.

---

## Padrões de Código

### Arquitetura em camadas (por feature)

```text
Screen/Component → Hook (React Query) → Service (Supabase) → Banco
```

1. **Service** (`features/<feature>/services/`): funções async que chamam o Supabase, usam `requireCurrentUserId()`, mapeiam o shape do banco (`type Row = {...}`) para os tipos da feature e lançam erros com mensagens em pt-BR.
2. **Hook** (`features/<feature>/hooks/`): wrappers de `useQuery`/`useMutation`; sempre `enabled: Boolean(userId)` e invalidação de caches relacionados no `onSuccess`.
3. **Screen**: consome os hooks; nunca chama o Supabase diretamente.

### Query keys

Centralizadas na factory `financeQueryKeys` em `src/features/finance/queryKeys.ts`. **Sempre usar a factory** — nunca arrays literais — para que as invalidações funcionem.

### Formatação e cálculos

Reutilizar os utilitários existentes (não recriar):

- `src/utils/format.ts`: `formatCurrencyBRL` ("R$ 1.234,56"), `formatSignedCurrencyBRL`, `formatShortDate`, `formatDateTitle`, `formatInstallmentLabel` ("3/12"), `weekBucket` (S1–S5), `groupTransactionsByDate`
- `src/features/finance/utils.ts`: `toNumber`, `clampPercent`, `normalizeCurrencyInput`, `formatCurrencyInput`, `formatMonthDate` ("2026-06-01"), `isoDate`
- Validações/máscaras de CPF, telefone e CEP: `src/features/auth/utils/`

### Convenções de nomes

- Telas: `XxxScreen` · Componentes: `PascalCase` · Hooks: `useXxx` · Services: `xxxService` · Tipos: `PascalCase` · Constantes: `UPPER_SNAKE_CASE`
- Datas de mês sempre no dia 1: `YYYY-MM-01`
- Valores monetários sempre em BRL formato pt-BR

### Testes

Jest (preset `jest-expo`), arquivos em `__tests__/` com sufixo `.test.ts`. Há testes para máscaras/validação de auth, importService, groupsService/groupMath, plans, profileService e viaCepService.

---

## Observações Importantes

- `src/components/TransictionListItem.tsx` é um **typo/legado** — usar `TransactionListItem.tsx`.
- `src/data/` contém apenas **mocks** de desenvolvimento — não usar em código de produção novo.
- Alguns textos da feature de ajuda têm problemas de encoding (ex.: "TransaÃ§Ãµes").
- O chat de suporte (`ChatScreen`/`ListChatScreen`) tem integração parcialmente concluída.
- `supabase/functions/` está excluído do `tsconfig.json` (é Deno, não Node/RN).
