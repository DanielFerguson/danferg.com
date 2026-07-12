import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import { remarkReadingTime } from "./remark-reading-time.mjs";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { readdirSync, readFileSync } from "node:fs";

const editorialDirectories = [
  new URL("./src/pages/articles/", import.meta.url),
  new URL("./src/pages/newsletters/", import.meta.url),
];

const lastModifiedByPath = new Map([
  ["/", new Date("2026-07-12T00:00:00.000Z")],
  ["/articles", new Date("2026-07-12T00:00:00.000Z")],
  ["/newsletters", new Date("2022-12-09T00:00:00.000Z")],
  ["/consulting", new Date("2026-07-12T00:00:00.000Z")],
  [
    "/2026-06-10-absa-announcement",
    new Date("2026-07-12T00:00:00.000Z"),
  ],
]);

for (const directory of editorialDirectories) {
  for (const filename of readdirSync(directory)) {
    if (!/\.(md|mdx)$/.test(filename)) continue;

    const source = readFileSync(new URL(filename, directory), "utf8");
    const canonicalPath = source.match(/^canonicalUrl:\s*["']?([^\n"']+)/m)?.[1];
    const updatedDate = source.match(/^updatedDate:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1];
    const publishedDate = source.match(/^date:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1];
    const lastModified = updatedDate || publishedDate;

    if (canonicalPath && lastModified) {
      lastModifiedByPath.set(
        canonicalPath,
        new Date(`${lastModified}T00:00:00.000Z`),
      );
    }
  }
}

// https://astro.build/config
export default defineConfig({
  site: "https://danferg.com",
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [
    sitemap({
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
    processor: unified({ remarkPlugins: [remarkReadingTime] }),
  },
  trailingSlash: "never",
  prefetch: {
    prefetchAll: false,
    defaultStrategy: "hover",
  },
});
