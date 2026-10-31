# Novidades do site — card 57

A página `nitin.com.br/novidades` e o painel `nitin.com.br/novidades/admin` ficam no repositório `app-financeiro-landing`. Os dados ficam neste Supabase, na migration `202610310001_product_updates.sql`.

## Modelo

- `product_updates` guarda as publicações. `published_at` nulo significa rascunho, invisível para visitantes e para contas comuns.
- `product_update_categories` guarda as categorias, editáveis no painel. O campo `stage` de cada categoria define o status mostrado no site: `released`, `in_development` ou `planned`.
- `site_editors` lista quem pode publicar. É separada de `support_agents`, porque atender usuários e publicar no site são permissões diferentes.
- O bucket público `product-updates` guarda as imagens. Só editores enviam ou removem arquivos, com limite de 2 MB e apenas PNG, JPEG ou WebP. A leitura é pública por URL e a listagem do bucket é restrita aos editores, então a imagem de um rascunho só é alcançável por quem tiver o endereço aleatório dela.

O site só usa a chave pública. Toda restrição de escrita está nas políticas RLS e `is_site_editor()` respeita a exigência de MFA da conta, como no suporte.

## Publicação coordenada

A ordem importa: sem a migration, o link "Novidades" do site leva a uma página de indisponibilidade.

1. Valide com `npm run test:product-updates:sql`.
2. Aplique a migration no Supabase. Ela cria as cinco categorias do card e oito publicações como rascunho; nada fica público.
3. Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na Vercel, nos ambientes Production e Preview, e publique o site.
4. Depois que a conta existir no nitin, confira o ID e habilite cada pessoa no SQL Editor. Prefira contas dedicadas, com MFA ativo. Nenhuma conta é habilitada pela migration.

```sql
insert into public.site_editors(user_id, display_name)
values ('UUID_DA_CONTA', 'Nome da pessoa');
```

5. Em `/novidades/admin`, revise os rascunhos e publique os que valem para o público. Eles foram escritos a partir do histórico deste repositório e do quadro do Trello. Vários recursos ainda estão em fase de teste, então só publique como lançado o que já estiver disponível para os usuários. O mesmo vale para os dois itens de roadmap, que são um compromisso público.

Para revogar o acesso, atualize `is_active = false` em `site_editors`.

## Inscrição por e-mail

Os itens RF10, RF11 e RNF07 do card estão na migration `202610310002_product_update_subscribers.sql`, nas Edge Functions `product-update-*` e no site. O formulário só aparece quando a variável `VITE_NEWS_SIGNUP_ENABLED` está ligada na Vercel, então o código pode ser publicado antes do provedor e da Política de Privacidade.

### Como funciona

1. A pessoa informa o e-mail e marca o consentimento, que vem desmarcado. O banco registra a data, a origem (`novidades` ou `publicacao`) e a versão do texto.
2. `product-update-subscribe` envia um e-mail com o link de confirmação, válido por 48 horas. Se o endereço já estiver confirmado, envia um aviso de que a inscrição está ativa. A resposta é sempre a mesma, para não revelar quem está inscrito.
3. O link abre uma página no site, e a confirmação só acontece no clique do botão, para que os verificadores de links dos provedores de e-mail não confirmem nada sozinhos.
4. Em `/novidades/admin`, a equipe vê os inscritos e envia uma publicação no ar aos confirmados. Cada publicação é enviada uma única vez. Se o envio parar no meio, "Continuar envio" retoma só quem falta.
5. Todo e-mail traz o link de cancelamento no corpo e os cabeçalhos `List-Unsubscribe` e `List-Unsubscribe-Post`, que permitem cancelar com um clique no próprio provedor de e-mail.

### Dados e permissões

- `product_update_subscribers` não tem leitura para visitantes nem para contas comuns. Editores leem só as colunas da lista, nunca os tokens, e ninguém escreve direto: as mudanças passam por funções restritas à `service_role`.
- O token de confirmação fica guardado como hash. O de descadastro fica em texto porque precisa entrar em todo e-mail, e só a `service_role` o alcança.
- A inscrição não tem ligação com contas do app. A exclusão de conta não afeta esta lista, e cancelar a inscrição não afeta a conta.
- Pedidos não confirmados são apagados depois que o link vence. Cancelamentos de quem nunca confirmou apagam o cadastro na hora. Cancelamentos de quem confirmou ficam guardados por 180 dias, para comprovar o consentimento e a revogação, e depois são apagados.

A limpeza roda a cada inscrição nova e a cada envio. Se a lista ficar muito tempo sem movimento, agende a limpeza para manter os prazos, junto do agendamento de `supabase/notifications_schedule.sql`:

```sql
select cron.schedule('purge-product-update-subscribers', '0 4 * * *', 'select private.purge_product_update_subscribers()');
```

### Limites

| O quê | Limite | Janela |
|---|---|---|
| Pedidos por endereço de e-mail | 3 | 1 dia |
| Pedidos no total | 100 | 1 hora |
| Confirmações no total | 300 | 15 minutos |
| Cancelamentos no total | 600 | 15 minutos |

Os limites não usam o IP do visitante, porque os cabeçalhos de IP podem ser forjados, como já está registrado em `cpf-auth`. Isso também evita tratar mais um dado pessoal. A contrapartida é que uma enxurrada de pedidos pode bloquear novas inscrições até a janela virar. Ajuste os valores em `consume_product_update_limit` se o plano do Resend for diferente, lembrando que o plano gratuito envia até 100 e-mails por dia e 3.000 por mês, somando confirmações e novidades. Se um envio passar desse limite, o painel para e "Continuar envio" retoma quem faltou no dia seguinte.

### Testes

```bash
npm run test:product-update-subscribers:sql
```

```bash
npm run test:product-update-subscribers:mutations
```

```bash
npx jest src/security/__tests__/productUpdateSubscriptions.test.ts
```

O primeiro roda as regras do banco e as funções de verdade contra um Postgres em memória, com o envio simulado. O segundo quebra cada regra da migration, uma por vez, e falha se o teste não perceber. O terceiro cobre validação, modelos de e-mail e a classificação das respostas do Resend.

### Publicação coordenada

A ordem importa: o formulário só pode aparecer quando as funções, o provedor e a nova política estiverem no ar.

1. Crie a conta do Resend e adicione o subdomínio `updates.nitin.com.br`, como o Resend recomenda, para separar a reputação de envio do e-mail da equipe. Escolha a região nesse momento: há São Paulo (`sa-east-1`), Virgínia do Norte, Irlanda e Tóquio, e trocar depois exige remover e adicionar o domínio de novo. Anote a região, porque a Política de Privacidade precisa citar o país correto.
2. Adicione na Vercel, que hospeda o DNS de `nitin.com.br`, os registros que o painel do Resend mostrar: `MX` e `TXT` em `send.updates` e `TXT` em `resend._domainkey.updates`. A opção Auto Configure do Resend também pode criá-los. Não altere os registros `MX` e SPF da raiz, que atendem o e-mail da Zoho usado por `contato@nitin.com.br`.
3. Depois que o domínio aparecer como verificado, gere uma chave com permissão só de envio.
4. Rode os testes acima.
5. Aplique a migration no Supabase. Ela depende de `202610310001_product_updates.sql` e `202608020001_rate_limit_maintenance.sql`.
6. Configure os segredos das Edge Functions. Não coloque a chave em arquivos nem em variáveis `VITE_`.

```bash
supabase secrets set RESEND_API_KEY=CHAVE_DO_RESEND
```

```bash
supabase secrets set "RESEND_FROM_EMAIL=nitin <novidades@updates.nitin.com.br>"
```

   Opcionais: `PRODUCT_UPDATES_SITE_URL` (padrão `https://nitin.com.br`), `PRODUCT_UPDATES_ALLOWED_ORIGINS` (padrão `https://nitin.com.br,https://www.nitin.com.br`, separadas por vírgula; inclua um endereço de Preview só durante um teste) e `PRODUCT_UPDATES_CONTACT_EMAIL` (padrão `contato@nitin.com.br`).

7. Publique as funções a partir deste repositório, para que o `supabase/config.toml` desligue a verificação de JWT só nas três públicas.

```bash
supabase functions deploy product-update-subscribe product-update-confirm product-update-unsubscribe product-update-send
```

8. Publique o site com `VITE_NEWS_SIGNUP_ENABLED` desligada.
9. Revise e publique a Política de Privacidade, que está em um PR separado no repositório do site. Ela é um documento legal e precisa ser aprovada pela equipe antes de ir ao ar.
10. Ligue `VITE_NEWS_SIGNUP_ENABLED=true` na Vercel, no ambiente Production, e publique de novo.
11. Faça uma inscrição com um e-mail da equipe, confirme, envie uma publicação e cancele pelo link. Confira também o cancelamento com um clique em um provedor que ofereça a opção.

### Quando o texto do consentimento mudar

Crie uma versão nova em `CONSENT_VERSION`, em `src/novidades/subscriptions.js` no site, e acrescente a mesma versão em `CONSENT_VERSIONS`, em `supabase/functions/_shared/productUpdateSubscriptions.ts`, mantendo a anterior. Publique a função antes do site. Registre o texto novo aqui:

| Versão | Texto mostrado |
|---|---|
| `2026-10-31` | Quero receber por e-mail as novidades do nitin. Li a Política de Privacidade e sei que posso cancelar a qualquer momento. |

### Pedidos de titulares

Se alguém pedir por escrito a remoção imediata, apague o cadastro no SQL Editor. As entregas ligadas a ele saem junto.

```sql
delete from public.product_update_subscribers where email = 'endereco@exemplo.com';
```
