import type { HelpArticle } from '../types';

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filtra artigos por categoria e texto. Cada palavra da busca precisa aparecer
 * no título, na categoria, na dica ou em algum passo (ignora acentos/caixa).
 */
export function filterHelpArticles(
  articles: HelpArticle[],
  search: string,
  categoryCode: string | null,
): HelpArticle[] {
  const terms = normalizeSearchText(search).split(/\s+/).filter(Boolean);

  return articles.filter((article) => {
    if (categoryCode && article.categoryCode !== categoryCode) {
      return false;
    }
    if (terms.length === 0) {
      return true;
    }

    const haystack = normalizeSearchText(
      [article.title, article.categoryLabel, article.tip, ...article.steps.map((step) => step.text)].join(' '),
    );
    return terms.every((term) => haystack.includes(term));
  });
}
