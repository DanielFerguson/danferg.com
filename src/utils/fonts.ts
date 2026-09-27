import { fontData } from "astro:assets";

/**
 * URL of the Latin, upright face for a font family configured in
 * astro.config.mjs, for a targeted <link rel="preload">. The Fonts API can only
 * preload every unicode-range subset of a local family at once; nearly every
 * page needs just the Latin file, so the other subsets load on demand.
 */
export function latinFontFileUrl(cssVariable: "--font-mono" | "--font-sans") {
  const upright = (fontData[cssVariable] ?? []).filter(
    (face) => face.style === "normal",
  );
  // Latin is declared last for each style in astro.config.mjs.
  const url = upright.at(-1)?.src[0]?.url;
  if (!url) throw new Error(`No upright font file configured for ${cssVariable}`);
  return url;
}
