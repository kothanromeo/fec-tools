export const SITE = {
  name: 'FEC Tools',
  tagline: 'Lire et vérifier un Fichier des Écritures Comptables (FEC), sans envoyer votre comptabilité',
  author: 'Roméo Kothan',
  authorUrl: 'https://github.com/kothanromeo',
  linkedin: 'https://www.linkedin.com/in/romeo-kothan/',
  instagram: 'https://www.instagram.com/romeokothan/',
  instagramHandle: '@romeokothan',
  portfolio: 'https://kothanromeo.dev/',
  repo: 'https://github.com/kothanromeo/fec-tools',
  /** Autres outils du même auteur, liés depuis le pied de page. */
  siblings: [
    { name: 'Factur-X Tools', url: 'https://factur-x-tools.kothanromeo.dev/', text: 'Lire, valider et créer des factures Factur-X' },
    { name: 'CFONB & camt Tools', url: 'https://cfonb-camt-tools.kothanromeo.dev/', text: 'Convertir un relevé bancaire CFONB ou camt.053 en Excel' },
  ],
  locale: 'fr_FR',
  lang: 'fr',
};

/** Préfixe un chemin interne avec la base du site (GitHub Pages sert le site dans un sous-dossier). */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (/^https?:/.test(path)) return path;
  return base + (path.startsWith('/') ? path : '/' + path);
}

export const NAV = [
  { href: '/', label: 'Lire un FEC' },
  { href: '/valider-fec/', label: 'Valider' },
  { href: '/ouvrir-fec-excel/', label: 'FEC en Excel' },
  { href: '/guides/', label: 'Guides' },
];

export interface FaqItem {
  q: string;
  /** Réponse en HTML simple. */
  a: string;
}

export function faqSchema(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.q,
      acceptedAnswer: { '@type': 'Answer', text: i.a.replace(/<[^>]+>/g, '') },
    })),
  };
}

export function breadcrumbSchema(site: URL, crumbs: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: new URL(href(c.path), site).toString(),
    })),
  };
}

export function toolSchema(site: URL, o: { name: string; path: string; description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: o.name,
    url: new URL(href(o.path), site).toString(),
    description: o.description,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Tous (navigateur web)',
    inLanguage: 'fr-FR',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    author: { '@type': 'Person', name: SITE.author, url: SITE.authorUrl },
  };
}
