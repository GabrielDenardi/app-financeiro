-- Rebranding: o app passa a se chamar "nitin".
-- Atualiza o bloco hero da tela Sobre (nome e descrição exibidos no app).

update public.app_content_blocks
set
  title = 'nitin',
  body = 'O nitin é o seu parceiro para organizar finanças, acompanhar metas, dividir despesas e entender sua vida financeira em um só lugar. Entradas e saídas, sempre em equilíbrio.'
where area = 'about' and key = 'hero';
