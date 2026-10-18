# Notificações

## Ambiente ativado em 18/10/2026

- Projeto Supabase: `App Financeiro` (`klgmrtyialfxjabvauft`). As quatro migrations desta feature foram aplicadas; o histórico remoto está sincronizado com os arquivos locais.
- `deliver-notifications` e `recommend-notifications` foram publicadas. O segredo privado do worker foi configurado nas Edge Functions e no Vault. A chave da OpenAI já existente foi preservada; `OPENAI_NOTIFICATION_MODEL` usa `gpt-4.1-mini`, o mesmo modelo configurado localmente para o parser.
- Job `deliver-financial-notifications` ativo a cada minuto via pg_cron/pg_net, com timeout HTTP de 60 segundos. Uma execução automática retornou HTTP 200, sem timeout nem erro de rede.
- Verificações remotas: worker autenticado HTTP 200; worker sem credencial HTTP 401; recomendações sem autenticação HTTP 401; lint do banco sem erros.
- Nenhuma nova build nativa foi gerada nesta ativação. O EAS Android ainda informa `None assigned yet` para FCM v1; push Android precisa dessa credencial e de uma build com o plugin para validação no aparelho. Não foram disparadas chamadas reais de IA na verificação; continuam condicionadas ao consentimento do usuário no app.
- Por decisão do usuário, a configuração do FCM ficou para a etapa da próxima build nativa.

## Instalação

1. Aplicar, em ordem, as migrations `202610180001` a `202610180004` no Supabase. O app deve ser publicado após as migrations.
2. Publicar as Edge Functions `deliver-notifications` e `recommend-notifications`. A primeira usa `verify_jwt = false` e exige seu próprio Bearer `NOTIFICATION_WORKER_SECRET`; a segunda mantém a validação JWT padrão e confere o usuário novamente.
3. Configurar `NOTIFICATION_WORKER_SECRET` aleatório no servidor. Configurar `OPENAI_API_KEY` e `OPENAI_NOTIFICATION_MODEL` (ou o modelo já usado em `OPENAI_PARSER_MODEL`) para IA. `EXPO_ACCESS_TOKEN` é opcional quando a segurança de acesso ao Expo Push estiver ativada.
4. Configurar um scheduler privado para chamar `POST /functions/v1/deliver-notifications` a cada minuto com `Authorization: Bearer <NOTIFICATION_WORKER_SECRET>`. O arquivo `supabase/notifications_schedule.sql` fornece o agendamento via pg_cron/pg_net, após criar os dois segredos indicados no Vault. Não colocar o segredo no app, no repositório ou em variáveis `EXPO_PUBLIC_*`.
5. Configurar as credenciais FCM v1/APNs do projeto EAS e gerar uma nova build nativa com o plugin `expo-notifications`. Push remoto não é validável pelo Expo Go Android. O projeto mantém pastas nativas locais ignoradas; regenerar com Expo Prebuild antes de uma build nativa local, preservando eventuais customizações locais.

## Comportamento

- A central interna usa Supabase e não depende da entrega push. Preferências por categoria ficam no banco e são específicas de cada usuário.
- A geração roda na abertura, a cada minuto com o app ativo, e no worker agendado com o app fechado. O worker percorre até 100 usuários por execução em rodízio; acima disso, a latência de alertas por data cresce conforme o número de lotes. Sem scheduler, os alertas por data só são gerados enquanto o app está ativo.
- Orçamentos: percentuais configuráveis (1–200, até cinco), maior patamar cruzado por orçamento/mês; patamares inferiores são registrados para não aparecerem depois de uma redução de gastos. Excluir o histórico não apaga a chave do evento.
- Vencimentos: recorrências de despesa ainda não confirmadas e faturas com saldo aberto, inclusive na virada do mês/ano. Dias 29–31 são ajustados ao último dia do mês. Uma recorrência variável lembra de conferir o valor, sem afirmar um valor futuro.
- Grupos: inserções e mudanças do valor de uma participação notificam o destinatário ativo, excluindo quem realizou a operação. Segurança: acessos e MFA registrados em `auth_login_events`, mudanças do bloqueio biométrico em `user_preferences` e alterações da senha persistidas em `auth.users`. Não há detecção automática de fraude financeira.
- Padrões: comparação com três meses completos com histórico, incluindo parcelas de cartão e apenas despesas reportáveis. Projeção diária após o sétimo dia do mês. São cálculos determinísticos, identificados separadamente da IA.
- IA: opt-in separado, desativado por padrão. A solicitação manual é limitada a uma por dia/usuário no banco, incluindo chamadas que falham. Apenas índices anônimos e percentuais de uso/projeção de até 50 orçamentos são enviados à OpenAI. O modelo escolhe orçamento e ação dentro de um schema; o banco produz a mensagem final com dados reais e revalida consentimento/destinatário. Não envia nomes, valores, transações ou IDs ao provedor.
- Push: ativado ao salvar preferências em uma build nativa instalada. O token pertence à sessão Supabase atual; revogar a sessão remove o dispositivo por FK. O opt-out de push é global para a conta. Detalhes ficam ocultos por padrão; o canal Android é privado na tela bloqueada.
- Horário silencioso usa o fuso salvo pelo aparelho; horário inicial igual ao final desativa a restrição. Segurança ignora o horário silencioso. O histórico interno fica disponível imediatamente.
- Ações abrem a área correspondente (orçamentos, recorrências, relatórios, segurança ou grupo). Notificações de fatura abrem a aba de cartões e o detalhe da fatura correspondente, após confirmar que ela pertence à lista do usuário atual.
- Tickets de push são `accepted` até confirmação do recibo do Expo; `delivered` significa aceitação por FCM/APNs, não prova de exibição no aparelho. Resultados de rede ambíguos ficam `unknown`, sem reenvio automático para evitar duplicação. Falhas permanecem rastreáveis em `notification_deliveries`. A leitura/interação fica em `read_at`/`interacted_at`.
- E-mail é opcional no card e não foi incluído. A coleta de status é operacional, sem disponibilizar tokens a clientes.

## Validação

`npm run test:notifications:sql` executa as migrations reais em PostgreSQL WASM (PGlite), com fixtures dos contratos existentes. Verifica geração, deduplicação após exclusão, preferências, triggers, RLS, grants de coluna, fila exclusiva, revogação de sessão e consentimento/limite de IA. Não substitui testar as migrations no Supabase de homologação.

`npm test -- --runInBand` e `npx tsc --noEmit` verificam os fluxos do app. A entrega real exige uma build Android/iOS, credenciais push, migrations, funções e scheduler publicados. Não usar o teste para disparar notificações em contas reais.

Referências: [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/), [envio e recibos Expo](https://docs.expo.dev/push-notifications/sending-notifications/), [Structured Outputs da OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).
