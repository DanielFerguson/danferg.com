import type { RSSFeedItem } from "@astrojs/rss";
import { getContainerRenderer as getMDXRenderer } from "@astrojs/mdx/container-renderer";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { loadRenderers } from "astro:container";
import { getCollection, render, type CollectionEntry } from "astro:content";
import { editorialUpdates } from "../data/editorial-updates";
import { tags as tagCatalogue, type TagId } from "../data/taxonomy";
import { FEED_CONTENT_END, FEED_CONTENT_START } from "./feed-markers";

const SITE = "https://danferg.com";
const asDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

let containerPromise: Promise<AstroContainer> | undefined;
const getContainer = () =>
  (containerPromise ??= loadRenderers([getMDXRenderer()]).then((renderers) =>
    AstroContainer.create({ renderers }),
  ));

const absolutise = (url: string) =>
  url.startsWith("/") && !url.startsWith("//") ? `${SITE}${url}` : url;

/**
 * Renders an entry's full body for feed readers: components become their
 * static HTML, scripts and styles are dropped (readers strip them anyway),
 * and root-relative links and images point back at the site.
 */
async function renderFeedContent(
  entry: CollectionEntry<"articles"> | CollectionEntry<"newsletters">,
) {
  const { Content } = await render(entry);
  const rendered = await (await getContainer()).renderToString(Content);
  // MDX entries come back wrapped in their layout; keep only the body.
  const start = rendered.indexOf(FEED_CONTENT_START);
  const end = rendered.lastIndexOf(FEED_CONTENT_END);
  const html =
    start !== -1 && end > start
      ? rendered.slice(start + FEED_CONTENT_START.length, end)
      : rendered;

  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<link\b[^>]*>/gi, "")
    .replace(/\s(?:data-astro-[\w-]+|data-motion-[\w-]+)(?:="[^"]*")?/g, "")
    .replace(/\s(href|src|poster)="([^"]*)"/g, (_, attribute, url) =>
      ` ${attribute}="${absolutise(url)}"`,
    )
    .replace(/\ssrcset="([^"]*)"/g, (_, srcset: string) =>
      ` srcset="${srcset
        .split(",")
        .map((candidate) => {
          const [url, ...descriptor] = candidate.trim().split(/\s+/);
          return [absolutise(url), ...descriptor].join(" ");
        })
        .join(", ")}"`,
    );
}

export async function getArticleFeedItems(): Promise<RSSFeedItem[]> {
  const articles = await getCollection("articles");

  return [
    ...(await Promise.all(
      articles.map(async (article) => ({
        title: article.data.title,
        description: article.data.description,
        link: article.data.canonicalUrl,
        pubDate: asDate(article.data.date),
        categories: [
          "Articles",
          ...((article.data.tags ?? []) as TagId[]).map(
            (tag) => tagCatalogue[tag].label,
          ),
        ],
        author: "gday@danferg.com (Dan Ferg)",
        content: await renderFeedContent(article),
        ...(article.data.audio
          ? {
              enclosure: {
                url: article.data.audio.url,
                type: article.data.audio.mimeType,
                length: article.data.audio.byteLength,
              },
            }
          : {}),
      })),
    )),
    ...editorialUpdates.map((update) => ({
      title: update.title,
      description: update.description,
      link: update.canonicalUrl,
      pubDate: asDate(update.date),
      categories: ["Articles", update.category],
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}

export async function getNewsletterFeedItems(): Promise<RSSFeedItem[]> {
  const newsletters = await getCollection("newsletters");

  return (
    await Promise.all(
      newsletters.map(async (newsletter) => ({
        title: newsletter.data.title,
        description: newsletter.data.description,
        link: newsletter.data.canonicalUrl,
        pubDate: asDate(newsletter.data.date),
        categories: ["Newsletters"],
        author: "gday@danferg.com (Dan Ferg)",
        content: await renderFeedContent(newsletter),
      })),
    )
  ).sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}
