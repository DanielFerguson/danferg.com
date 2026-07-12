import type { RSSFeedItem } from "@astrojs/rss";
import { getCollection } from "astro:content";
import { editorialUpdates } from "../data/editorial-updates";

const asDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

export async function getArticleFeedItems(): Promise<RSSFeedItem[]> {
  const articles = await getCollection("articles");

  return [
    ...articles.map((article) => ({
      title: article.data.title,
      description: article.data.description,
      link: article.data.canonicalUrl,
      pubDate: asDate(article.data.date),
      categories: ["Articles"],
    })),
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

  return newsletters
    .map((newsletter) => ({
      title: newsletter.data.title,
      description: newsletter.data.description,
      link: newsletter.data.canonicalUrl,
      pubDate: asDate(newsletter.data.date),
      categories: ["Newsletters"],
    }))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
}
