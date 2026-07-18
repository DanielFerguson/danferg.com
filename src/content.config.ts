import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date in YYYY-MM-DD format");
const canonicalPath = z
  .string()
  .regex(/^\/(?!\/).+|^\/$/, "Use a root-relative canonical path");
const imageUrl = z.string().min(1);

const editorialFields = {
  layout: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(40),
  date: isoDate,
  updatedDate: isoDate.optional(),
  imageUrl,
  imageUrls: z.array(imageUrl).optional(),
  imageAlt: z.string().min(1).optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
  imageType: z.string().min(1).optional(),
  canonicalUrl: canonicalPath,
};

const articles = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: "./src/pages/articles" }),
  schema: z.object(editorialFields),
});

const articleDrafts = defineCollection({
  loader: glob({
    pattern: "*.{md,mdx}",
    base: "./src/content/drafts/articles",
  }),
  schema: z.object({
    ...editorialFields,
    draft: z.literal(true),
    canonicalUrl: z
      .string()
      .regex(
        /^\/articles\/[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/,
        "Draft article canonical URLs must be clean /articles/{slug} paths",
      ),
  }),
});

const newsletters = defineCollection({
  loader: glob({ pattern: "*.mdx", base: "./src/pages/newsletters" }),
  schema: z.object(editorialFields),
});

const projects = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: "./src/pages/projects" }),
  schema: z.object({
    layout: z.string().optional(),
    title: z.string().min(1),
    description: z.string().min(40),
    tags: z.array(z.string().min(1)).min(1),
    featured: z.boolean().optional(),
    highlight: z.boolean().optional(),
    highlightDiagram: z.string().min(1).optional(),
    period: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    externalUrl: z.url().optional(),
    externalLabel: z.string().min(1).optional(),
    caseStudyLabel: z.string().min(1).optional(),
    visualLabel: z.string().min(1).optional(),
    imageKey: z.string().min(1),
    imageAlt: z.string().min(1).optional(),
    canonicalUrl: canonicalPath,
    publishedDate: isoDate.optional(),
    updatedDate: isoDate.optional(),
  }),
});

export const collections = { articles, articleDrafts, newsletters, projects };
