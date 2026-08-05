/**
 * The hero ships as its own app, while the rest of the site is still the static
 * HTML at the repository root. Same-origin relative links are correct once both
 * are deployed together, but they 404 against the dev server — set
 * VITE_SITE_BASE_URL (e.g. https://resonare.digital) to point at the live pages
 * while developing. See .env.example.
 */
const BASE = (import.meta.env.VITE_SITE_BASE_URL ?? '').replace(/\/$/, '');

export const siteUrl = (path: string): string => `${BASE}${path}`;

export const SITE_PATHS = {
  home: '/',
  about: '/about.html',
  services: '/services.html',
  work: '/work.html',
  contact: '/contact.html',
} as const;
