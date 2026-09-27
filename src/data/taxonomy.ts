/**
 * Controlled vocabulary for articles.
 *
 * Tags are flat. A tag must be listed here before an article can use it, so a typo in
 * frontmatter fails the content schema instead of quietly creating a new tag.
 * A series groups multi-part work in order; parts are listed here so unpublished parts can
 * still appear as "coming" without breaking links.
 */

export const tags = {
  startups: { label: "Startups", description: "Building companies, experiments in public, launches and endings." },
  product: { label: "Product", description: "Product thinking, design decisions and what makes something useful." },
  software: { label: "Software", description: "Code, languages, architecture and the trade-offs between them." },
  ai: { label: "AI", description: "Models, learning systems and how to tell whether they are working." },
  hardware: { label: "Hardware", description: "Connected devices, sensors and the physical side of software." },
  "civic-tech": { label: "Civic tech", description: "Community engagement, institutions and the feedback loops between them." },
  politics: { label: "Politics", description: "Elections, policy, public accountability and how to check a claim." },
  "victorian-election-2026": { label: "Victorian election 2026", description: "Working through the November 2026 state election as a regional voter." },
  "regional-victoria": { label: "Regional Victoria", description: "Country roads, farms, levies and living outside Melbourne." },
  education: { label: "Education", description: "Learning, teaching and the systems around them." },
  privacy: { label: "Privacy", description: "Personal data, security and what free software costs." },
  money: { label: "Money", description: "Everyday financial choices and what they say about values." },
  music: { label: "Music", description: "Guitars, pedals and the odd side project." },
  reflections: { label: "Reflections", description: "Burnout, rest, direction and the personal side of building things." },
} as const;

export type TagId = keyof typeof tags;
export const tagIds = Object.keys(tags) as [TagId, ...TagId[]];

export interface SeriesPart {
  part: number;
  title: string;
  /** Canonical path once written; omit for a planned part. */
  path?: string;
}

export const series = {
  "working-out-my-vote": {
    label: "Working out my vote",
    description:
      "An evolving guide to Victoria’s 2026 election from a country Labor voter: the grievances checked against the evidence, the government’s record, the integrity findings, and then the alternatives.",
    parts: [
      { part: 1, title: "Working out my vote in Victoria’s 2026 election", path: "/articles/victoria-election-2026" },
      { part: 2, title: "Regional roads: what the audit actually found", path: "/articles/victoria-2026-regional-roads" },
      { part: 3, title: "The emergency-services levy: why people remember different numbers", path: "/articles/victoria-2026-emergency-services-levy" },
      { part: 4, title: "Labor’s record: the years behind this election", path: "/articles/victoria-2026-labor-record" },
      { part: 5, title: "What the integrity investigations actually found", path: "/articles/victoria-2026-integrity-findings" },
      { part: 6, title: "Victoria’s roads and emergency services: comparing the promises", path: "/articles/victoria-2026-roads-emergency-services" },
      { part: 7, title: "Housing and the cost of living: comparing the promises", path: "/articles/victoria-2026-housing-cost-of-living" },
      { part: 8, title: "Energy, climate and regional communities: comparing the promises", path: "/articles/victoria-2026-energy-climate" },
      { part: 9, title: "Getting care in regional Victoria" },
      { part: 10, title: "The state budget and the promises competing for it", path: "/articles/victoria-2026-state-budget" },
      { part: 11, title: "Integrity, accountability and competent government", path: "/articles/victoria-2026-integrity-accountability" },
      { part: 12, title: "The people actually on my ballot" },
      { part: 13, title: "How I’m weighing my vote" },
    ] as SeriesPart[],
  },
} as const;

export type SeriesId = keyof typeof series;
export const seriesIds = Object.keys(series) as [SeriesId, ...SeriesId[]];

export function tagHref(id: TagId) {
  return `/articles/tag/${id}`;
}

export function seriesHref(id: SeriesId) {
  return `/articles/series/${id}`;
}
