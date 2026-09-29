/**
 * Shape of a category landing page design, stored as JSON in
 * category_landing_pages.content. The admin panel edits it; the storefront
 * renders it above the category's product grid.
 */

export const LANDING_PATTERNS = ['none', 'dots', 'grid', 'arches', 'waves'] as const;
export const LANDING_ICONS = [
  'truck',
  'shield',
  'star',
  'gift',
  'leaf',
  'sparkles',
  'heart',
  'bolt',
  'home',
  'book',
  'tag',
  'clock',
] as const;

export type LandingPattern = (typeof LANDING_PATTERNS)[number];
export type LandingIcon = (typeof LANDING_ICONS)[number];

export interface LandingContent {
  theme: {
    /** Main accent (buttons, eyebrow text, icons). */
    accent: string;
    /** Light tint used for the hero and section backgrounds. */
    soft: string;
    /** Dark shade used for headings on the tinted background. */
    ink: string;
    pattern: LandingPattern;
  };
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    /** Storage path (e.g. "category-landings/abc.webp"); when empty the
     * storefront shows a collage of the category's own product photos. */
    image: string | null;
  };
  highlights: {
    enabled: boolean;
    items: { icon: LandingIcon; title: string; text: string }[];
  };
  featured: {
    enabled: boolean;
    title: string;
    subtitle: string;
    /** auto = best sellers in the category, topped up with newest. */
    mode: 'auto' | 'manual';
    productIds: number[];
    limit: number;
  };
  promo: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    text: string;
    ctaLabel: string;
    ctaHref: string;
    image: string | null;
  };
  story: {
    enabled: boolean;
    title: string;
    text: string;
  };
}

export const DEFAULT_LANDING_CONTENT: LandingContent = {
  theme: { accent: '#0B3D2E', soft: '#EEF4EF', ink: '#0B3D2E', pattern: 'dots' },
  hero: { eyebrow: '', title: '', subtitle: '', ctaLabel: 'Shop now', image: null },
  highlights: {
    enabled: true,
    items: [
      { icon: 'truck', title: 'Fast delivery', text: 'All over Bangladesh' },
      { icon: 'shield', title: 'Quality checked', text: 'Every item inspected' },
      { icon: 'tag', title: 'Best price', text: 'Fair, honest pricing' },
    ],
  },
  featured: { enabled: true, title: 'Best sellers', subtitle: '', mode: 'auto', productIds: [], limit: 8 },
  promo: { enabled: false, eyebrow: '', title: '', text: '', ctaLabel: '', ctaHref: '', image: null },
  story: { enabled: false, title: '', text: '' },
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const STORAGE_PATH = /^category-landings\/[\w-]+\.(jpg|jpeg|png|webp)$/;

function str(value: unknown, max: number, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function hex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value) ? value.toUpperCase() : fallback;
}

function imagePath(value: unknown): string | null {
  return typeof value === 'string' && STORAGE_PATH.test(value) ? value : null;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Only internal paths ("/products?..."), so a stored link can't send
 * shoppers to another site. */
function internalHref(value: unknown): string {
  const href = str(value, 300);
  return href.startsWith('/') && !href.startsWith('//') ? href : '';
}

/** Whitelists and clamps whatever the admin panel sent into a valid
 * LandingContent, filling gaps from the defaults. */
export function sanitizeLandingContent(input: unknown): LandingContent {
  const d = DEFAULT_LANDING_CONTENT;
  const root = obj(input);
  const theme = obj(root.theme);
  const hero = obj(root.hero);
  const highlights = obj(root.highlights);
  const featured = obj(root.featured);
  const promo = obj(root.promo);
  const story = obj(root.story);

  const items = Array.isArray(highlights.items) ? highlights.items : d.highlights.items;
  const productIds = Array.isArray(featured.productIds) ? featured.productIds : [];
  const limit = Number(featured.limit);

  return {
    theme: {
      accent: hex(theme.accent, d.theme.accent),
      soft: hex(theme.soft, d.theme.soft),
      ink: hex(theme.ink, d.theme.ink),
      pattern: pick(theme.pattern, LANDING_PATTERNS, d.theme.pattern),
    },
    hero: {
      eyebrow: str(hero.eyebrow, 60),
      title: str(hero.title, 90),
      subtitle: str(hero.subtitle, 240),
      ctaLabel: str(hero.ctaLabel, 30, d.hero.ctaLabel),
      image: imagePath(hero.image),
    },
    highlights: {
      enabled: bool(highlights.enabled, d.highlights.enabled),
      items: items.slice(0, 4).map((raw) => {
        const item = obj(raw);
        return {
          icon: pick(item.icon, LANDING_ICONS, 'sparkles'),
          title: str(item.title, 40),
          text: str(item.text, 80),
        };
      }),
    },
    featured: {
      enabled: bool(featured.enabled, d.featured.enabled),
      title: str(featured.title, 60, d.featured.title),
      subtitle: str(featured.subtitle, 140),
      mode: pick(featured.mode, ['auto', 'manual'] as const, 'auto'),
      productIds: [...new Set(productIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 12),
      limit: Number.isInteger(limit) ? Math.min(Math.max(limit, 4), 12) : d.featured.limit,
    },
    promo: {
      enabled: bool(promo.enabled, d.promo.enabled),
      eyebrow: str(promo.eyebrow, 40),
      title: str(promo.title, 80),
      text: str(promo.text, 200),
      ctaLabel: str(promo.ctaLabel, 30),
      ctaHref: internalHref(promo.ctaHref),
      image: imagePath(promo.image),
    },
    story: {
      enabled: bool(story.enabled, d.story.enabled),
      title: str(story.title, 90),
      text: str(story.text, 1500),
    },
  };
}
