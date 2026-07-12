import rss from "@astrojs/rss";
import { getArticleFeedItems } from "../../utils/feed-items";

export async function GET(context: { site: URL | undefined }) {
  return rss({
    title: "Dan Ferg — articles",
    description:
      "Articles and research notes on product strategy, useful software, entrepreneurship, and evidence-led work.",
    site: context.site || new URL("https://danferg.com"),
    items: await getArticleFeedItems(),
    customData: "<language>en-AU</language>",
    trailingSlash: false,
  });
}
