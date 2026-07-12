import rss from "@astrojs/rss";
import { getNewsletterFeedItems } from "../../utils/feed-items";

export async function GET(context: { site: URL | undefined }) {
  return rss({
    title: "Dan Ferg — newsletters",
    description:
      "Longer dispatches from the projects, ideas, and experiments Dan Ferg has built in public.",
    site: context.site || new URL("https://danferg.com"),
    items: await getNewsletterFeedItems(),
    customData: "<language>en-AU</language>",
    trailingSlash: false,
  });
}
