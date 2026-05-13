export type AboutFeature = {
  id: string;
  title: string;
  order: number;
};

export type AboutLink = {
  id: string;
  area: 'about_social' | 'about_legal';
  key: string;
  label: string;
  url: string;
  icon: string;
  order: number;
};

export type AboutContent = {
  appName: string;
  version: string;
  heroBody: string;
  ratingTitle: string;
  ratingBody: string;
  features: AboutFeature[];
  socialLinks: AboutLink[];
  legalLinks: AboutLink[];
};
