import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import { remarkReadingTime } from "./remark-reading-time.mjs";
import sitemap from "@astrojs/sitemap";
import robotsTxt from "astro-robots-txt";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  site: "https://danferg.com",
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [sitemap(), mdx(), robotsTxt()],
  markdown: {
    processor: unified({ remarkPlugins: [remarkReadingTime] }),
  },
  trailingSlash: "never",
});
