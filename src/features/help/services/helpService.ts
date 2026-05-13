import { supabase } from '../../../lib/supabase';
import type { HelpArticle, HelpCategory } from '../types';

type HelpCategoryRow = {
  id: string;
  code: string;
  label: string;
  color: string;
  icon: string;
  display_order: number;
};

type HelpArticleStepRow = {
  id: string;
  step_order: number;
  text: string;
};

type HelpArticleRow = {
  id: string;
  title: string;
  level: string;
  popular: boolean;
  tip: string;
  display_order: number;
  category_id: string;
  help_categories: HelpCategoryRow | HelpCategoryRow[] | null;
  help_article_steps: HelpArticleStepRow[] | null;
};

function mapCategory(row: HelpCategoryRow): HelpCategory {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    color: row.color,
    icon: row.icon,
    displayOrder: row.display_order ?? 0,
  };
}

function mapArticle(row: HelpArticleRow): HelpArticle {
  const category = Array.isArray(row.help_categories) ? row.help_categories[0] : row.help_categories;

  return {
    id: row.id,
    categoryId: row.category_id,
    categoryCode: category?.code ?? 'general',
    categoryLabel: category?.label ?? 'Geral',
    title: row.title,
    level: row.level,
    popular: Boolean(row.popular),
    tip: row.tip ?? '',
    displayOrder: row.display_order ?? 0,
    steps: (row.help_article_steps ?? [])
      .slice()
      .sort((left, right) => left.step_order - right.step_order)
      .map((step) => ({
        id: step.id,
        order: step.step_order,
        text: step.text,
      })),
  };
}

export async function listHelpCategories(): Promise<HelpCategory[]> {
  const { data, error } = await supabase
    .from('help_categories')
    .select('id, code, label, color, icon, display_order')
    .order('display_order', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data as HelpCategoryRow[] | null) ?? []).map(mapCategory);
}

export async function listHelpArticles(search?: string | null, categoryCode?: string | null): Promise<HelpArticle[]> {
  let query = supabase
    .from('help_articles')
    .select(
      `
        id,
        title,
        level,
        popular,
        tip,
        display_order,
        category_id,
        help_categories(id, code, label, color, icon, display_order),
        help_article_steps(id, step_order, text)
      `,
    )
    .order('popular', { ascending: false })
    .order('display_order', { ascending: true });

  if (search?.trim()) {
    query = query.ilike('title', `%${search.trim()}%`);
  }

  if (categoryCode?.trim()) {
    const { data: categoryData, error: categoryError } = await supabase
      .from('help_categories')
      .select('id')
      .eq('code', categoryCode.trim())
      .maybeSingle();

    if (categoryError) {
      throw new Error(categoryError.message);
    }

    const categoryId = (categoryData as { id: string } | null)?.id;
    if (!categoryId) {
      return [];
    }

    query = query.eq('category_id', categoryId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data as HelpArticleRow[] | null) ?? []).map(mapArticle);
}
