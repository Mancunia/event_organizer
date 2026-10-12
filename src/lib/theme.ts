import { z } from "zod";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const imageUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), "Image links must start with http:// or https://");

/** How event photos are laid out behind the guest pages. "discs" is the photo-free Bloom & Vow default. */
export const BACKDROPS = {
  discs: "Soft discs (no photos)",
  fullbleed: "Full-screen photo",
  blurred: "Dreamy blurred photo",
  collage: "Photo collage",
  polaroids: "Scattered polaroids",
} as const;
export type Backdrop = keyof typeof BACKDROPS;
export const MAX_PHOTOS = 12;

export const themeSchema = z.object({
  primary: hex.default("#2e3d4e"),
  accent: hex.default("#eccfbf"),
  background: hex.default("#fbf7f4"),
  heroImageUrl: imageUrl.optional().or(z.literal("").transform(() => undefined)),
  photos: z.array(imageUrl).max(MAX_PHOTOS).default([]),
  backdrop: z.enum(Object.keys(BACKDROPS) as [Backdrop, ...Backdrop[]]).default("discs"),
});

export type Theme = z.infer<typeof themeSchema>;

export function parseTheme(value: unknown): Theme {
  const result = themeSchema.safeParse(value ?? {});
  return result.success ? result.data : themeSchema.parse({});
}

/** Hero photo first, then the rest of the gallery, without duplicates. */
export function eventPhotos(theme: Theme) {
  return [...new Set([theme.heroImageUrl, ...theme.photos].filter((u): u is string => Boolean(u)))];
}

const DEFAULTS = themeSchema.parse({});
/** Defaults from before the Bloom & Vow palette; events saved with them pick up the new palette. */
const LEGACY = { primary: "#7a5c3e", accent: "#c9a96e", background: "#fbf7f1" };
const isDefault = (key: keyof typeof LEGACY, value: string) =>
  [DEFAULTS[key], LEGACY[key]].includes(value.toLowerCase());

/**
 * Organiser colour overrides as CSS, scoped to `.event-theme`. They only apply to the light (Daylight) palette,
 * so the dark (Candlelight) palette keeps its contrast. Values are validated hex, safe to inline.
 */
export function themeOverrideCss(theme: Theme) {
  const vars = [
    !isDefault("primary", theme.primary) && `--slate:${theme.primary};--slate-hover:${theme.primary};--focus:${theme.primary};`,
    !isDefault("accent", theme.accent) && `--blush:${theme.accent};`,
    !isDefault("background", theme.background) && `--paper:${theme.background};`,
  ]
    .filter(Boolean)
    .join("");
  if (!vars) return null;
  return `@media (prefers-color-scheme: light){.event-theme{${vars}}}@media (prefers-color-scheme: dark){:root[data-theme="light"] .event-theme{${vars}}}`;
}
