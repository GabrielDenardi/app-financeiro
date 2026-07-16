import { supabase } from '../../../lib/supabase';
import type { AboutContent, AboutFeature, AboutLink } from '../types';

type ContentRow = {
  id: string;
  area: string;
  key: string;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  display_order: number;
};

type LinkRow = {
  id: string;
  area: 'about_social' | 'about_legal';
  key: string;
  label: string;
  url: string;
  icon: string;
  display_order: number;
};

function mapFeature(row: ContentRow): AboutFeature {
  return {
    id: row.id,
    title: row.title,
    order: row.display_order ?? 0,
  };
}

function mapLink(row: LinkRow): AboutLink {
  return {
    id: row.id,
    area: row.area,
    key: row.key,
    label: row.label,
    url: row.url,
    icon: row.icon,
    order: row.display_order ?? 0,
  };
}

export async function getAboutContent(): Promise<AboutContent> {
  const [{ data: contentData, error: contentError }, { data: linksData, error: linksError }] =
    await Promise.all([
      supabase
        .from('app_content_blocks')
        .select('id, area, key, title, body, metadata, display_order')
        .in('area', ['about', 'about_feature'])
        .order('display_order', { ascending: true }),
      supabase
        .from('app_external_links')
        .select('id, area, key, label, url, icon, display_order')
        .in('area', ['about_social', 'about_legal'])
        .order('display_order', { ascending: true }),
    ]);

  if (contentError || linksError) {
    throw new Error(contentError?.message ?? linksError?.message ?? 'Não foi possível carregar o conteúdo institucional.');
  }

  const contentRows = (contentData as ContentRow[] | null) ?? [];
  const linkRows = (linksData as LinkRow[] | null) ?? [];
  const hero = contentRows.find((row) => row.area === 'about' && row.key === 'hero');
  const rating = contentRows.find((row) => row.area === 'about' && row.key === 'rating');
  const features = contentRows
    .filter((row) => row.area === 'about_feature')
    .map(mapFeature);

  // O conteúdo do banco pode conter o nome antigo do app ("Finance Control")
  // enquanto a migration de rebranding não for aplicada no Supabase.
  const rebrand = (value: string) => value.replaceAll('Finance Control', 'nitin');

  return {
    appName: hero?.title ? rebrand(hero.title) : 'nitin',
    version: typeof hero?.metadata?.version === 'string' ? hero.metadata.version : '1.0.0',
    heroBody: hero?.body ? rebrand(hero.body) : '',
    ratingTitle: rating?.title || 'Sua opinião importa',
    ratingBody: rating?.body || '',
    features,
    socialLinks: linkRows.filter((row) => row.area === 'about_social').map(mapLink),
    legalLinks: linkRows.filter((row) => row.area === 'about_legal').map(mapLink),
  };
}
