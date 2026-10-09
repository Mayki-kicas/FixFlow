import type { MetadataRoute } from 'next';

// Web App Manifest : rend l'outil installable sur mobile (écran d'accueil).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FixFlow — GMAO',
    short_name: 'Tickets',
    description: 'Gestion de maintenance interne',
    start_url: '/tickets',
    display: 'standalone',
    background_color: '#f6f5f2',
    theme_color: '#e8513b',
    lang: 'fr',
  };
}
