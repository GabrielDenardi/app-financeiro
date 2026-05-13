export type HelpCategory = {
  id: string;
  code: string;
  label: string;
  color: string;
  icon: string;
  displayOrder: number;
};

export type HelpArticleStep = {
  id: string;
  order: number;
  text: string;
};

export type HelpArticle = {
  id: string;
  categoryId: string;
  categoryCode: string;
  categoryLabel: string;
  title: string;
  level: string;
  popular: boolean;
  tip: string;
  displayOrder: number;
  steps: HelpArticleStep[];
};
