import rss from "@astrojs/rss";
import {
  getArticleFeedItems,
  getNewsletterFeedItems,
} from "../utils/feed-items";

export async function GET(context: { site: URL | undefined }) {
  const items = [
    ...(await getArticleFeedItems()),
    ...(await getNewsletterFeedItems()),
  ].sort(
    (a, b) =>
      new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime()
  );

  return rss({
    title: "Dan Ferg — articles and dispatches",
    description:
      "Writing about product strategy, useful software, entrepreneurship, evidence, and the work behind Dan Ferg's projects.",
    site: context.site || new URL("https://danferg.com"),
    items,
    customData: "<language>en-AU</language>",
    trailingSlash: false,
  });
}
