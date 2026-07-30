# Assinaturas Android com Google Play e RevenueCat

O app usa o Google Play Billing como processador das assinaturas Android. O
RevenueCat valida as compras, unifica os estados da assinatura e sincroniza o
plano com o Supabase.

## 1. Definir o package definitivo

O package definitivo configurado no Expo e no projeto Android é:

```text
com.nitin.appfinanceiro
```

Depois que o aplicativo for publicado, esse identificador não poderá ser
alterado.

## 2. Criar o aplicativo e enviar um build

1. Crie o aplicativo no Google Play Console com o package definitivo.
2. Gere um Android App Bundle de desenvolvimento ou produção.
3. Envie o `.aab` para a faixa de teste interno.

O Google Play só libera a criação de assinaturas depois que um APK/AAB estiver
associado ao aplicativo.

## 3. Criar as assinaturas

Crie três produtos em `Monetização > Produtos > Assinaturas`:

| Plano | Product ID | Preço mensal |
|---|---|---:|
| Básico | `appfinanceiro_basic_v1` | R$ 7,99 |
| Intermediário | `appfinanceiro_intermediate_v1` | R$ 12,99 |
| Pro | `appfinanceiro_pro_v1` | R$ 14,99 |

Em cada produto, crie e ative o base plan:

```text
monthly-autorenewing
```

Os identificadores são permanentes. Se forem alterados, atualize também
`src/features/billing/revenuecatProducts.ts` e a função compartilhada
`supabase/functions/_shared/revenuecat.ts`.

## 4. Configurar o RevenueCat

Durante o desenvolvimento sem Google Play, a chave pública do Test Store,
iniciada por `test_`, pode ser usada na mesma variável:

```dotenv
EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY=test_...
```

Antes de publicar, substitua obrigatoriamente essa chave pela chave pública
Android iniciada por `goog_`.

1. Crie um projeto no RevenueCat.
2. Adicione um app Google Play usando o mesmo package.
3. Conecte a conta de serviço da Google Play.
4. Importe os produtos:
   - `appfinanceiro_basic_v1:monthly-autorenewing`
   - `appfinanceiro_intermediate_v1:monthly-autorenewing`
   - `appfinanceiro_pro_v1:monthly-autorenewing`
5. Crie o entitlement `paid_access` e associe os três produtos.
6. Crie uma Offering, marque-a como Current e adicione os três produtos como
   packages customizados.
7. Copie a chave pública Android, iniciada por `goog_`, para o `.env`:

```dotenv
EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY=goog_...
```

Somente a chave pública pode ficar no app.

## 5. Configurar o Supabase

Crie uma chave secreta V1 no RevenueCat e um token aleatório para autenticar o
webhook. Salve ambos apenas nos secrets do Supabase:

```powershell
npx supabase secrets set REVENUECAT_SECRET_API_KEY=sk_...
npx supabase secrets set REVENUECAT_WEBHOOK_AUTH_TOKEN=...
```

Aplique a migration e publique as funções:

```powershell
npx supabase db push
npx supabase functions deploy sync-revenuecat-subscription
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
```

No RevenueCat, cadastre:

```text
URL: https://SEU_PROJECT_REF.supabase.co/functions/v1/revenuecat-webhook
Authorization: Bearer O_MESMO_TOKEN_CONFIGURADO_NO_SUPABASE
```

Ative eventos de produção e sandbox enquanto estiver executando os testes
internos.

Depois de confirmar o novo fluxo em produção, remova as funções legadas que
tenham sido publicadas anteriormente:

```powershell
npx supabase functions delete create-abacatepay-subscription
npx supabase functions delete abacatepay-webhook
```

Essa remoção não apaga as tabelas ou o histórico de cobranças da AbacatePay.

## 6. Testar

1. Adicione as contas Google dos testadores no teste de licença.
2. Instale o app pela faixa de teste interno da Play Store.
3. Confirme compra, renovação de sandbox, cancelamento, expiração, upgrade,
   downgrade e restauração.
4. Confirme no Supabase:
   - `profiles.subscription_provider = 'google_play'`;
   - `profiles.subscription_plan` corresponde ao produto;
   - o evento existe em `billing_provider_events`.

Compras reais não funcionam no Expo Go. Use um development build ou uma versão
instalada pela Play Store.
