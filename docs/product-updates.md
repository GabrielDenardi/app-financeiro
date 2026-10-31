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

Os itens RF10 e RF11 do card ficaram fora desta entrega, por decisão da equipe, e seguem em um PR separado. Hoje nenhuma Edge Function envia e-mail, então a inscrição exige domínio verificado em um provedor, confirmação em duas etapas, descadastro e atualização da Política de Privacidade com a nova finalidade e o novo operador. Esta entrega não coleta nenhum dado de visitantes.
