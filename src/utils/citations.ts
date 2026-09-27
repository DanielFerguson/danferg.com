const SELF_HOSTS = new Set(["danferg.com", "www.danferg.com"]);

// Profile and social links are not sources the writing relies on.
const NON_CITATION_HOSTS = [
  "linkedin.com",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "github.com",
];

/**
 * Collects the external sources an article links to, in reading order, for the
 * schema.org `citation` property. Works on raw Markdown and MDX (including
 * JSX `href` attributes), so it can read collection entry bodies directly.
 */
export function extractCitationUrls(body: string | undefined) {
  if (!body) return [];

  const urls = [
    ...body.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g),
    ...body.matchAll(/href=["'](https?:\/\/[^"']+)["']/g),
  ]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((match) => match[1]);

  const citations: string[] = [];
  for (const url of urls) {
    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (SELF_HOSTS.has(host)) continue;
    if (NON_CITATION_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
      continue;
    }
    if (!citations.includes(url)) citations.push(url);
  }
  return citations;
}
