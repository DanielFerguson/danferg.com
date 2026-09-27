/**
 * One place that turns the article collections (and, in development, drafts) into the list
 * items the archive, tag pages and series pages render. Keeps the three views consistent.
 */
import { getCollection } from "astro:content";
import getReadingTime from "reading-time";
import { editorialUpdates } from "./editorial-updates";
import { series as seriesCatalogue, tags as tagCatalogue, type SeriesId, type TagId } from "./taxonomy";

export interface ArchiveItem {
  title: string;
  description: string;
  href: string;
  date: string;
  meta: string;
  detail?: string;
  tags: TagId[];
  series?: { id: SeriesId; part: number };
  draft: boolean;
}

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );

export async function loadArchive(): Promise<ArchiveItem[]> {
  const articles = await getCollection("articles");
  const drafts = import.meta.env.DEV ? await getCollection("articleDrafts") : [];

  const items: ArchiveItem[] = [
    ...drafts.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      href: entry.data.canonicalUrl,
      date: entry.data.date,
      meta: `DRAFT // ${formatDate(entry.data.date)}`,
      detail: `${getReadingTime(entry.body || "").text} · LOCAL ONLY`,
      tags: (entry.data.tags ?? []) as TagId[],
      series: entry.data.series as ArchiveItem["series"],
      draft: true,
    })),
    ...articles.map((entry) => ({
      title: entry.data.title,
      description: entry.data.description,
      href: entry.data.canonicalUrl,
      date: entry.data.date,
      meta: formatDate(entry.data.date),
      detail: getReadingTime(entry.body || "").text,
      tags: (entry.data.tags ?? []) as TagId[],
      series: entry.data.series as ArchiveItem["series"],
      draft: false,
    })),
    ...editorialUpdates.map((update) => ({
      title: update.title,
      description: update.description,
      href: update.canonicalUrl,
      date: update.date,
      meta: formatDate(update.date),
      detail: update.category,
      tags: [] as TagId[],
      series: undefined,
      draft: false,
    })),
  ];

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function tagCounts(items: ArchiveItem[]) {
  const counts = new Map<TagId, number>();
  for (const item of items) for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return (Object.keys(tagCatalogue) as TagId[])
    .filter((id) => counts.has(id))
    .map((id) => ({ id, label: tagCatalogue[id].label, description: tagCatalogue[id].description, count: counts.get(id)! }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function seriesGroups(items: ArchiveItem[]) {
  return (Object.keys(seriesCatalogue) as SeriesId[])
    .map((id) => {
      const definition = seriesCatalogue[id];
      const members = items
        .filter((item) => item.series?.id === id)
        .sort((a, b) => (a.series?.part ?? 0) - (b.series?.part ?? 0));
      return { id, label: definition.label, description: definition.description, total: definition.parts.length, members };
    })
    .filter((group) => group.members.length > 0);
}
