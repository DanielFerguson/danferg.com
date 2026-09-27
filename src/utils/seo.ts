const SITE_NAME = "Dan Ferg";

/**
 * Builds the document <title>. Headlines often end in a full stop for effect
 * ("When doing nothing starts to feel wrong."), which reads oddly in search
 * results, so a single trailing full stop is dropped.
 */
export function pageTitle(title: string, seoTitle?: string) {
  const base = (seoTitle ?? title).trim().replace(/(?<!\.)\.$/, "");
  return `${base} | ${SITE_NAME}`;
}
