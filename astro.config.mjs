import { defineConfig, fontProviders } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import { rehypeMermaidBlocks } from "./rehype-mermaid-blocks.mjs";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import mdx from "@astrojs/mdx";
import { readdirSync, readFileSync } from "node:fs";
import { MIN_INDEXABLE_TAG_ARTICLES } from "./src/data/taxonomy.ts";

const editorialDirectories = {
  "/articles": new URL("./src/pages/articles/", import.meta.url),
  "/newsletters": new URL("./src/pages/newsletters/", import.meta.url),
  "/projects": new URL("./src/pages/projects/", import.meta.url),
};

const lastModifiedByPath = new Map();
const excludedFromSitemap = new Set();
const articleTagCounts = new Map();
const toDate = (isoDate) => new Date(`${isoDate}T00:00:00.000Z`);
const noteLatest = (path, date) => {
  const current = lastModifiedByPath.get(path);
  if (!current || date > current) lastModifiedByPath.set(path, date);
};

for (const [sectionPath, directory] of Object.entries(editorialDirectories)) {
  for (const filename of readdirSync(directory)) {
    if (!/\.(md|mdx)$/.test(filename)) continue;

    const source = readFileSync(new URL(filename, directory), "utf8");
    const canonicalPath = source.match(
      /^canonicalUrl:\s*["']?([^\n"']+)/m,
    )?.[1];
    const updatedDate = source.match(
      /^updatedDate:\s*["']?(\d{4}-\d{2}-\d{2})/m,
    )?.[1];
    const publishedDate = source.match(
      /^(?:date|publishedDate):\s*["']?(\d{4}-\d{2}-\d{2})/m,
    )?.[1];
    const lastModified = updatedDate || publishedDate;
    const hidden = /^visible:\s*false\s*$/m.test(source);

    if (canonicalPath && hidden) excludedFromSitemap.add(canonicalPath);
    if (canonicalPath && lastModified && !hidden) {
      const date = toDate(lastModified);
      lastModifiedByPath.set(canonicalPath, date);
      // Archive pages and the homepage change whenever an entry does.
      noteLatest(sectionPath, date);
      noteLatest("/", date);
    }

    if (sectionPath === "/articles") {
      const tags = source.match(/^tags:\s*\[([^\]]*)\]/m)?.[1] ?? "";
      for (const tag of tags.split(",").map((value) => value.trim()).filter(Boolean)) {
        articleTagCounts.set(tag, (articleTagCounts.get(tag) ?? 0) + 1);
      }
    }
  }
}

for (const [tag, count] of articleTagCounts) {
  if (count < MIN_INDEXABLE_TAG_ARTICLES) excludedFromSitemap.add(`/articles/tag/${tag}`);
}

// Standalone pages declare their own modifiedDate in their SEO props.
for (const page of ["about", "consulting", "speaking"]) {
  const source = readFileSync(new URL(`./src/pages/${page}.astro`, import.meta.url), "utf8");
  const modified = source.match(/modifiedDate:\s*["'](\d{4}-\d{2}-\d{2})["']/)?.[1];
  if (modified) lastModifiedByPath.set(`/${page}`, toDate(modified));
}

// Geist ships as variable fonts split by unicode range. Only the subsets this
// English-language site renders are declared: Latin, Latin Extended and (for
// Geist Mono) the box-drawing symbols used in the terminal-style components.
const fontsourceFile = (family, file) =>
  `./node_modules/@fontsource-variable/${family}/files/${file}.woff2`;
const unicodeRanges = {
  symbols2: "U+2000-2001,U+2004-2008,U+200A,U+23B8-23BD,U+2500-259F",
  latinExt:
    "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
  latin:
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
};
// Later faces win where ranges overlap, so Latin is declared last.
const geistVariants = (family, subsets, styles) =>
  styles.flatMap((style) =>
    subsets.map(([subset, range]) => ({
      src: [fontsourceFile(family, `${family}-${subset}-wght-${style}`)],
      weight: "100 900",
      style,
      unicodeRange: [range],
    })),
  );

// https://astro.build/config
export default defineConfig({
  site: "https://danferg.com",
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Geist Mono",
      cssVariable: "--font-mono",
      fallbacks: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      options: {
        variants: geistVariants(
          "geist-mono",
          [
            ["symbols2", unicodeRanges.symbols2],
            ["latin-ext", unicodeRanges.latinExt],
            ["latin", unicodeRanges.latin],
          ],
          ["normal"],
        ),
      },
    },
    {
      provider: fontProviders.local(),
      name: "Geist",
      cssVariable: "--font-sans",
      fallbacks: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      options: {
        variants: geistVariants(
          "geist",
          [
            ["latin-ext", unicodeRanges.latinExt],
            ["latin", unicodeRanges.latin],
          ],
          ["normal", "italic"],
        ),
      },
    },
  ],
  vite: {
    build: {
      rolldownOptions: {
        onwarn(warning, defaultHandler) {
          // Astro marks MDX modules with this directive for its own head
          // injection. Rolldown (Vite 8.3+) warns about every one of them even
          // though the built HTML is unchanged, which buries real warnings.
          if (
            warning.code === "MODULE_LEVEL_DIRECTIVE" &&
            warning.message.includes("use astro:head-inject")
          ) {
            return;
          }
          defaultHandler(warning);
        },
      },
    },
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !excludedFromSitemap.has(new URL(page).pathname.replace(/\/$/, "")),
      serialize(item) {
        const pathname = new URL(item.url).pathname.replace(/\/$/, "") || "/";
        const lastmod = lastModifiedByPath.get(pathname);

        return lastmod ? { ...item, lastmod } : item;
      },
    }),
    mdx(),
    robotsTxt(),
  ],
  markdown: {
    syntaxHighlight: { type: "shiki", excludeLangs: ["mermaid"] },
    processor: unified({
      rehypePlugins: [rehypeMermaidBlocks],
    }),
  },
  trailingSlash: "never",
  // Prefetch every internal link on hover or focus, so navigation feels instant
  // without downloading pages the reader never points at.
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
});
