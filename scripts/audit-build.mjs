import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { brotliCompressSync } from "node:zlib";
import { parse } from "parse5";

const projectRoot = resolve(import.meta.dirname, "..");
const distRoot = resolve(projectRoot, "dist");
const failures = [];
const warnings = [];

const fail = (message) => failures.push(message);
const warn = (message) => warnings.push(message);
const attr = (node, name) =>
  node.attrs?.find((attribute) => attribute.name === name)?.value;
const textContent = (node) =>
  node.nodeName === "#text"
    ? node.value
    : (node.childNodes || []).map(textContent).join("");
const normalizeText = (value = "") => value.replace(/\s+/g, " ").trim();

function findAll(node, predicate, matches = []) {
  if (predicate(node)) matches.push(node);
  for (const child of node.childNodes || []) findAll(child, predicate, matches);
  return matches;
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }
  return files;
}

function routeForFile(file) {
  const path = relative(distRoot, file).replaceAll("\\", "/");
  if (path === "index.html") return "/";
  if (path.endsWith("/index.html")) return `/${path.slice(0, -11)}`;
  return `/${path.replace(/\.html$/, "")}`;
}

async function existingTarget(pathname) {
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, "");
  const candidates = [
    join(distRoot, relativePath),
    join(distRoot, `${relativePath}.html`),
    join(distRoot, relativePath, "index.html"),
  ];
  if (!relativePath) candidates.push(join(distRoot, "index.html"));

  for (const candidate of candidates) {
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next generated-file shape.
    }
  }
  return undefined;
}

const htmlFiles = (await listFiles(distRoot)).filter((file) => file.endsWith(".html"));
const pages = [];

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const document = parse(html);
  const route = routeForFile(file);
  const elements = findAll(document, (node) => Boolean(node.tagName));
  const byTag = (tagName) => elements.filter((node) => node.tagName === tagName);
  const metas = byTag("meta");
  const meta = (key, value) =>
    metas.find((node) => attr(node, key) === value);
  const links = byTag("link");
  const canonical = links.find((node) => attr(node, "rel") === "canonical");
  const titleNodes = byTag("title");
  const description = meta("name", "description");
  const robots = meta("name", "robots");
  const h1s = byTag("h1");
  const headings = elements.filter((node) => /^h[1-6]$/.test(node.tagName));
  const ids = elements.map((node) => attr(node, "id")).filter(Boolean);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const jsonLdScripts = byTag("script").filter(
    (node) => attr(node, "type") === "application/ld+json",
  );

  if (attr(byTag("html")[0], "lang") !== "en-AU") fail(`${route}: html lang is not en-AU`);
  if (titleNodes.length !== 1 || !normalizeText(textContent(titleNodes[0]))) fail(`${route}: expected one non-empty title`);
  if (!description || !attr(description, "content")) fail(`${route}: missing meta description`);
  if (!robots || !attr(robots, "content")) fail(`${route}: missing robots directive`);
  if (!canonical || !attr(canonical, "href")) fail(`${route}: missing canonical`);
  if (h1s.length !== 1) fail(`${route}: expected one H1, found ${h1s.length}`);
  for (let index = 1; index < headings.length; index += 1) {
    const previousLevel = Number(headings[index - 1].tagName.slice(1));
    const level = Number(headings[index].tagName.slice(1));
    if (level > previousLevel + 1) {
      fail(
        `${route}: heading order jumps from ${headings[index - 1].tagName.toUpperCase()} to ${headings[index].tagName.toUpperCase()} (${normalizeText(textContent(headings[index]))})`,
      );
    }
  }
  if (!elements.some((node) => node.tagName === "main" && attr(node, "id") === "main-content")) fail(`${route}: missing main#main-content`);
  if (duplicateIds.length) fail(`${route}: duplicate IDs ${[...new Set(duplicateIds)].join(", ")}`);
  if (jsonLdScripts.length !== 1) fail(`${route}: expected one JSON-LD script, found ${jsonLdScripts.length}`);

  let structuredData;
  try {
    structuredData = JSON.parse(textContent(jsonLdScripts[0]));
    if (structuredData["@context"] !== "https://schema.org") throw new Error("missing Schema.org context");
    if (!Array.isArray(structuredData["@graph"])) throw new Error("missing @graph");
    const graphIds = structuredData["@graph"].map((entry) => entry["@id"]).filter(Boolean);
    if (new Set(graphIds).size !== graphIds.length) throw new Error("duplicate graph IDs");
  } catch (error) {
    fail(`${route}: invalid JSON-LD (${error.message})`);
  }

  for (const property of ["og:url", "og:title", "og:description", "og:image", "og:image:width", "og:image:height", "og:image:type", "og:image:alt"]) {
    if (!meta("property", property)?.attrs) fail(`${route}: missing ${property}`);
  }
  for (const name of ["twitter:card", "twitter:title", "twitter:description", "twitter:image", "twitter:image:alt"]) {
    if (!meta("name", name)?.attrs) fail(`${route}: missing ${name}`);
  }

  const images = byTag("img");
  for (const image of images) {
    const src = attr(image, "src") || "unknown image";
    if (attr(image, "alt") === undefined) fail(`${route}: image missing alt (${src})`);
    if (!attr(image, "width") || !attr(image, "height")) fail(`${route}: image missing dimensions (${src})`);
  }

  const canonicalUrl = attr(canonical, "href");
  const ogImageUrl = attr(meta("property", "og:image"), "content");
  if (ogImageUrl) {
    const parsedImageUrl = new URL(ogImageUrl, canonicalUrl);
    if (parsedImageUrl.hostname === "danferg.com") {
      const imageFile = await existingTarget(parsedImageUrl.pathname);
      if (!imageFile) {
        fail(`${route}: local Open Graph image does not exist (${ogImageUrl})`);
      } else if ((await stat(imageFile)).size > 200_000) {
        fail(`${route}: local Open Graph image exceeds 200 KB (${ogImageUrl})`);
      }
    }
  }
  const indexable = !attr(robots, "content").includes("noindex");
  const h1 = normalizeText(textContent(h1s[0]));
  const ogTitle = attr(meta("property", "og:title"), "content");
  const contentEntity = structuredData?.["@graph"]?.find((entry) =>
    ["Article", "BlogPosting", "CreativeWork"].includes(entry["@type"]),
  );
  if (contentEntity && normalizeText(contentEntity.headline || contentEntity.name) !== h1) {
    fail(`${route}: H1 does not match content schema headline`);
  }
  if ((contentEntity || route === "/" || route === "/consulting") && normalizeText(ogTitle) !== h1) {
    fail(`${route}: H1 does not match Open Graph title`);
  }

  const descriptionLength = attr(description, "content")?.length || 0;
  const titleLength = normalizeText(textContent(titleNodes[0])).length;
  if (titleLength > 65) warn(`${route}: title is ${titleLength} characters`);
  if (descriptionLength > 165) warn(`${route}: description is ${descriptionLength} characters`);

  const anchors = byTag("a").map((node) => ({ href: attr(node, "href"), text: normalizeText(textContent(node)) }));
  pages.push({
    file,
    route,
    html,
    document,
    canonicalUrl,
    indexable,
    ids: new Set(ids),
    anchors,
    externalScripts: byTag("script").map((node) => attr(node, "src")).filter((src) => src?.startsWith("/")),
    stylesheets: links.filter((node) => attr(node, "rel") === "stylesheet").map((node) => attr(node, "href")).filter((href) => href?.startsWith("/")),
  });
}

const canonicalPages = new Map(pages.map((page) => [new URL(page.canonicalUrl).pathname, page]));
const indexableCanonicals = pages.filter((page) => page.indexable).map((page) => page.canonicalUrl);
if (new Set(indexableCanonicals).size !== indexableCanonicals.length) fail("Duplicate indexable canonical URLs");

const inboundLinks = new Map(indexableCanonicals.map((url) => [url, 0]));
for (const page of pages) {
  for (const anchor of page.anchors) {
    if (!anchor.href || /^(https?:|mailto:|tel:|javascript:)/.test(anchor.href)) continue;
    const targetUrl = new URL(anchor.href, page.canonicalUrl);
    const targetFile = await existingTarget(targetUrl.pathname);
    if (!targetFile) {
      fail(`${page.route}: broken internal link ${anchor.href}`);
      continue;
    }

    const targetPage = canonicalPages.get(targetUrl.pathname.replace(/\/$/, "") || "/");
    if (targetUrl.hash && targetPage && !targetPage.ids.has(targetUrl.hash.slice(1))) {
      fail(`${page.route}: missing fragment ${anchor.href}`);
    }
    const targetCanonical = targetPage?.canonicalUrl;
    if (targetCanonical && inboundLinks.has(targetCanonical) && targetCanonical !== page.canonicalUrl) {
      inboundLinks.set(targetCanonical, inboundLinks.get(targetCanonical) + 1);
    }
  }
}
for (const [canonicalUrl, count] of inboundLinks) {
  if (canonicalUrl !== "https://danferg.com/" && count === 0) fail(`${canonicalUrl}: no internal inbound links`);
}

const sitemapFiles = (await listFiles(distRoot)).filter((file) => /sitemap-\d+\.xml$/.test(file));
const sitemapUrls = new Set();
for (const file of sitemapFiles) {
  const xml = await readFile(file, "utf8");
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    sitemapUrls.add(new URL(match[1]).toString());
  }
}
for (const canonicalUrl of indexableCanonicals) {
  if (!sitemapUrls.has(canonicalUrl)) fail(`${canonicalUrl}: missing from sitemap`);
}
if (sitemapUrls.has("https://danferg.com/404")) fail("404 is present in sitemap");

const datedSitemap = await Promise.all(sitemapFiles.map((file) => readFile(file, "utf8")));
if (!datedSitemap.join("").includes("<lastmod>")) fail("Sitemap has no lastmod entries");

const robotsText = await readFile(join(distRoot, "robots.txt"), "utf8");
if (!/Sitemap:\s*https:\/\/danferg\.com\/sitemap-index\.xml/.test(robotsText)) fail("robots.txt does not advertise sitemap");

for (const feed of ["rss.xml", "articles/rss.xml", "newsletters/rss.xml"]) {
  const xml = await readFile(join(distRoot, feed), "utf8");
  if (!xml.includes("<rss") || !xml.includes("<item>")) fail(`${feed}: invalid or empty RSS feed`);
}

const homepage = pages.find((page) => page.route === "/");
const htmlBrotli = brotliCompressSync(homepage.html).byteLength;
let cssBrotli = 0;
for (const href of homepage.stylesheets) {
  cssBrotli += brotliCompressSync(await readFile(join(distRoot, href))).byteLength;
}
let jsBrotli = 0;
for (const src of homepage.externalScripts) {
  jsBrotli += brotliCompressSync(await readFile(join(distRoot, src))).byteLength;
}
if (htmlBrotli > 15_000) fail(`Homepage HTML exceeds 15 KB Brotli (${htmlBrotli})`);
if (cssBrotli > 15_000) fail(`Homepage CSS exceeds 15 KB Brotli (${cssBrotli})`);
if (jsBrotli > 10_000) fail(`Homepage JS exceeds 10 KB Brotli (${jsBrotli})`);

const homepageCss = (
  await Promise.all(homepage.stylesheets.map((href) => readFile(join(distRoot, href), "utf8")))
).join("");
if (/\.project-header|\.story-header/.test(homepageCss)) fail("Homepage still contains detail-layout CSS");

if (failures.length) {
  console.error(`Build audit failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Build audit passed: ${pages.length} HTML pages, ${sitemapUrls.size} sitemap URLs, ${indexableCanonicals.length} indexable canonicals.`);
  console.log(`Homepage Brotli: ${(htmlBrotli / 1024).toFixed(1)} KB HTML, ${(cssBrotli / 1024).toFixed(1)} KB CSS, ${(jsBrotli / 1024).toFixed(1)} KB JS.`);
}
if (warnings.length) {
  console.warn(`Warnings (${warnings.length}):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}
