import { getCollection } from "astro:content";

const SITE = "https://danferg.com";
const absolute = (path: string) => new URL(path, SITE).toString();
const byNewest = <T extends { data: { date?: string; publishedDate?: string } }>(
  a: T,
  b: T,
) =>
  (b.data.date ?? b.data.publishedDate ?? "").localeCompare(
    a.data.date ?? a.data.publishedDate ?? "",
  );

/**
 * A plain-Markdown map of the site for language-model tools, following the
 * llms.txt proposal (https://llmstxt.org): who Dan is, what he offers, and
 * one line per article and case study, generated from the same collections
 * as the pages so it never drifts.
 */
export async function GET() {
  const articles = (await getCollection("articles")).sort(byNewest);
  const projects = (await getCollection("projects"))
    .filter((project) => project.data.visible !== false)
    .sort(byNewest);
  const newsletters = (await getCollection("newsletters")).sort(byNewest);

  const lines = [
    "# Dan Ferg",
    "",
    "> Dan Ferg (Daniel Ferguson) is a Melbourne-based product consultant, advisor and software builder. He helps founders and mission-led teams turn hard product, operational and community problems into useful software, traction and a clearer route to market. He founded Helping Group after the 2020 Australian bushfires and was CEO of civic technology company Communiti Labs from 2023 to 2026.",
    "",
    "Everything below is published at danferg.com in Australian English. Articles carry a short answer near the top; case studies cover the problem, what was built, and what Dan learned.",
    "",
    "## About and services",
    "",
    `- [About Dan Ferg](${absolute("/about")}): background, current work and career history.`,
    `- [Consulting](${absolute("/consulting")}): product strategy, traction and go-to-market advisory, and software delivery for founders and mission-led teams, in Australia and remotely.`,
    `- [Speaking](${absolute("/speaking")}): podcast appearances on community engagement and responsible AI, and earlier talks on entrepreneurship and leadership.`,
    `- [Agent Skills](${absolute("/skills")}): installable skills Dan publishes, including Chef for meal planning.`,
    "",
    "## Articles",
    "",
    ...articles.map(
      (article) =>
        `- [${article.data.title}](${absolute(article.data.canonicalUrl)}): ${article.data.summary ?? article.data.description}`,
    ),
    "",
    "## Case studies",
    "",
    ...projects.map(
      (project) =>
        `- [${project.data.title}](${absolute(project.data.canonicalUrl)}): ${project.data.description}`,
    ),
    "",
    "## Optional",
    "",
    ...newsletters.map(
      (newsletter) =>
        `- [${newsletter.data.title}](${absolute(newsletter.data.canonicalUrl)}): ${newsletter.data.description} (2022 newsletter archive)`,
    ),
    `- [RSS feed with full article text](${absolute("/rss.xml")})`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
