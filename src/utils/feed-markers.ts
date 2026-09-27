// HTML comments around an entry's body in ArticleLayout and NewsletterLayout.
// MDX entries render with their frontmatter layout, so feeds use these to take
// the body alone rather than the whole page.
export const FEED_CONTENT_START = "<!--feed-content:start-->";
export const FEED_CONTENT_END = "<!--feed-content:end-->";
