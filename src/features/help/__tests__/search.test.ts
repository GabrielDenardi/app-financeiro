import type { HelpArticle } from '../types';
import { filterHelpArticles, normalizeSearchText } from '../utils/search';

function makeArticle(overrides: Partial<HelpArticle>): HelpArticle {
  return {
    id: '1',
    categoryId: 'c1',
    categoryCode: 'cards',
    categoryLabel: 'Cartões',
    title: 'Como pagar a fatura',
    level: 'Básico',
    popular: false,
    tip: '',
    displayOrder: 0,
    steps: [{ id: 's1', order: 1, text: 'Abra a tela de cartões' }],
    ...overrides,
  };
}

describe('help search', () => {
  const articles = [
    makeArticle({}),
    makeArticle({
      id: '2',
      categoryCode: 'goals',
      categoryLabel: 'Metas',
      title: 'Criar uma meta',
      steps: [{ id: 's2', order: 1, text: 'Toque em nova meta' }],
    }),
  ];

  it('normaliza acentos e caixa', () => {
    expect(normalizeSearchText('  CARTÕES ')).toBe('cartoes');
  });

  it('ignora acentos na busca', () => {
    expect(filterHelpArticles(articles, 'cartoes', null)).toHaveLength(1);
  });

  it('busca também nos passos', () => {
    expect(filterHelpArticles(articles, 'nova meta', null).map((a) => a.id)).toEqual(['2']);
  });

  it('combina categoria e texto', () => {
    expect(filterHelpArticles(articles, 'meta', 'cards')).toHaveLength(0);
    expect(filterHelpArticles(articles, '', 'goals')).toHaveLength(1);
  });
});
