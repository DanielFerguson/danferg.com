import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { seriesIds, tagIds } from "./data/taxonomy";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use an ISO date in YYYY-MM-DD format");
const canonicalPath = z
  .string()
  .regex(/^\/(?!\/).+|^\/$/, "Use a root-relative canonical path");
const imageUrl = z.string().min(1);
const audioUrl = z.union([canonicalPath, z.url()]);
const articleAudio = z.object({
  provider: z.literal("elevenlabs"),
  storage: z.enum(["vercel-static", "cloudflare-r2"]),
  url: audioUrl,
  mimeType: z.literal("audio/mpeg"),
  byteLength: z.number().int().positive(),
  voiceId: z.string().min(1),
  modelId: z.string().min(1),
  outputFormat: z.string().regex(/^mp3_\d+_\d+$/),
  sourceHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  generatedAt: z.iso.datetime({ offset: true }),
});

// Search result titles get " | Dan Ferg" appended; 54 characters keeps the
// whole <title> inside the 65-character budget checked by the build audit.
const seoTitle = z.string().min(20).max(54);

const editorialFields = {
  layout: z.string().optional(),
  title: z.string().min(1),
  seoTitle: seoTitle.optional(),
  // A self-contained answer to the question the piece explores. Rendered as
  // an "In short" block and reused in feeds, llms.txt and structured data.
  summary: z.string().min(80).max(420).optional(),
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
  // Flat, controlled tags (see src/data/taxonomy.ts); unknown tags fail the build.
  tags: z.array(z.enum(tagIds)).max(6).optional(),
  // Membership of an ordered multi-part series.
  series: z
    .object({ id: z.enum(seriesIds), part: z.number().int().positive() })
    .optional(),
};

const articles = defineCollection({
  loader: glob({ pattern: "*.{md,mdx}", base: "./src/pages/articles" }),
  schema: z.object({ ...editorialFields, audio: articleAudio.optional() }),
});

const articleDrafts = defineCollection({
  // Avoid compiling private draft content or emitting its styles in production.
  loader: import.meta.env.PROD
    ? async () => []
    : glob({
        pattern: "*.{md,mdx}",
        base: "./src/content/drafts/articles",
      }),
  schema: z.object({
    ...editorialFields,
    audio: articleAudio.optional(),
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
    seoTitle: seoTitle.optional(),
    description: z.string().min(40),
    tags: z.array(z.string().min(1)).min(1),
    featured: z.boolean().optional(),
    visible: z.boolean().optional(),
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
