# Atendimento humano — card 53

O app e o painel independente `nitin-support` compartilham as tabelas de suporte. O painel usa autenticação Supabase, sem chave administrativa no navegador. As RPCs validam proprietário/atendente, plano e MFA e impedem escrita direta nas tabelas.

## Publicação coordenada

1. Valide com `node scripts/test-human-support.cjs`, `npx tsc --noEmit` e os testes Jest.
2. Aplique `202610280002_human_support.sql` no Supabase. Ela substitui a escrita direta por RPCs; versões anteriores do app precisarão ser atualizadas para enviar mensagens.
3. Gere uma nova build nativa do app, pois `expo-crypto` foi adicionado para os identificadores de envio.
4. Configure e publique o painel conforme seu README. Ele só precisa da URL e da chave pública do projeto.
5. Quando a equipe estiver definida, habilite explicitamente as contas dedicadas em `support_agents`. Nenhuma conta é habilitada pela migration.
6. Com duas contas de teste (cliente Pro e atendente), valide a troca real entre app e painel, o retorno após desconexão, a leitura, o encerramento/reabertura e o recebimento de push em dispositivo autorizado. Confirme que o worker existente de notificações está ativo.

Mensagens da equipe geram uma notificação genérica da categoria `system`, sem o texto da conversa, e usam a fila de push existente. O destino é validado como uma conversa de chat; o banco continua verificando acesso ao abri-la. As mensagens são persistidas antes de confirmar o envio. Novas tentativas do mesmo envio mantêm o identificador para não duplicar conteúdo.

O teste SQL usa o PostgreSQL isolado do PGlite, com helpers de autenticação/plano de teste e as migrations reais de suporte e fila de notificação. Ele não substitui a validação em dispositivo e com Supabase Realtime real. O painel inclui uma fixture local para QA da interface, documentada no seu README.
