import { mkdir, readFile, readdir } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const outputRoot = resolve(projectRoot, "public/images/og");
const collections = [
  {
    name: "articles",
    directory: resolve(projectRoot, "src/pages/articles"),
    extensions: new Set([".md", ".mdx"]),
    label: "ARTICLE",
  },
  {
    name: "newsletters",
    directory: resolve(projectRoot, "src/pages/newsletters"),
    extensions: new Set([".mdx"]),
    label: "DISPATCH",
  },
];
const formats = [
  { suffix: "og", width: 1200, height: 630 },
  { suffix: "16x9", width: 1200, height: 675 },
  { suffix: "4x3", width: 1200, height: 900 },
  { suffix: "1x1", width: 1200, height: 1200 },
];

const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

function readField(source, field) {
  const rawValue = source.match(new RegExp(`^${field}:\\s*(.+)$`, "m"))?.[1]?.trim();
  if (!rawValue) return undefined;

  const quote = rawValue[0];
  return (quote === '"' || quote === "'") && rawValue.at(-1) === quote
    ? rawValue.slice(1, -1)
    : rawValue;
}

function wrapText(value, maxCharacters, maxLines) {
  const words = value.split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxCharacters || !line) {
      line = candidate;
      continue;
    }

    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }

  if (line && lines.length < maxLines) {
    const consumed = lines.join(" ").length;
    const hasMore = consumed + line.length < value.length - 1;
    lines.push(hasMore ? `${line.replace(/[.,;:!?-]+$/, "")}…` : line);
  }

  return lines;
}

function cardSvg({ title, description, date, label, width, height }) {
  const square = height >= 1100;
  const titleSize = square ? 76 : height >= 850 ? 70 : 64;
  const titleLines = wrapText(title, square ? 25 : 31, 3);
  const descriptionLines = wrapText(description, square ? 48 : 72, 2);
  const titleStart = square ? 270 : height >= 850 ? 240 : 225;
  const titleStep = titleSize * 1.12;
  const descriptionStart = titleStart + titleLines.length * titleStep + 42;
  const footerY = height - 70;
  const descriptionMarkup = descriptionLines
    .map(
      (line, index) =>
        `<text x="72" y="${descriptionStart + index * 38}" fill="#414651" font-size="25">${escapeXml(line)}</text>`,
    )
    .join("");
  const titleMarkup = titleLines
    .map(
      (line, index) =>
        `<text x="72" y="${titleStart + index * titleStep}" fill="#181d27" font-size="${titleSize}" font-weight="800" letter-spacing="-3">${escapeXml(line)}</text>`,
    )
    .join("");

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4f39f6" stroke-opacity="0.075" stroke-width="1"/>
    </pattern>
    <linearGradient id="signal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f39f6"/>
      <stop offset="1" stop-color="#1b1070"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#f8f7fc"/>
  <rect width="${width}" height="${height}" fill="url(#grid)"/>
  <rect x="34" y="34" width="${width - 68}" height="${height - 68}" fill="none" stroke="#1b1070" stroke-width="2"/>
  <rect x="34" y="34" width="${width - 68}" height="54" fill="#1b1070"/>
  <g font-family="SFMono-Regular, Consolas, Liberation Mono, monospace">
    <text x="68" y="69" fill="#f8f7fc" font-size="20" font-weight="700" letter-spacing="2">DANFERG.COM // ${escapeXml(label)}</text>
    <circle cx="1100" cy="61" r="7" fill="#cc66ff"/>
    <text x="1080" y="69" fill="#f8f7fc" font-size="16" text-anchor="end">${escapeXml(date)}</text>
    <text x="72" y="158" fill="#4f39f6" font-size="19" font-weight="700" letter-spacing="3">BUILDING / LEARNING / EVIDENCE</text>
    ${titleMarkup}
    ${descriptionMarkup}
    <rect x="72" y="${footerY - 39}" width="1056" height="1" fill="#1b1070" fill-opacity="0.45"/>
    <rect x="72" y="${footerY - 22}" width="62" height="40" fill="url(#signal)" transform="rotate(-3 103 ${footerY - 2})"/>
    <text x="103" y="${footerY + 5}" fill="#f8f7fc" font-size="17" font-weight="800" text-anchor="middle">D/F</text>
    <text x="154" y="${footerY + 5}" fill="#1b1070" font-size="25" font-weight="800">DAN FERG</text>
    <text x="1128" y="${footerY + 5}" fill="#717680" font-size="17" text-anchor="end">MELBOURNE, AUSTRALIA</text>
  </g>
</svg>`;
}

for (const collection of collections) {
  const filenames = await readdir(collection.directory);
  const outputDirectory = resolve(outputRoot, collection.name);
  await mkdir(outputDirectory, { recursive: true });

  for (const filename of filenames) {
    if (!collection.extensions.has(extname(filename))) continue;

    const source = await readFile(resolve(collection.directory, filename), "utf8");
    const title = readField(source, "title");
    const description = readField(source, "description");
    const date = readField(source, "date");
    if (!title || !description || !date) continue;

    const slug = basename(filename, extname(filename));
    for (const format of formats) {
      const outputPath = resolve(
        outputDirectory,
        `${slug}-${format.suffix}.png`,
      );
      const svg = cardSvg({
        title,
        description,
        date,
        label: collection.label,
        width: format.width,
        height: format.height,
      });
      await sharp(Buffer.from(svg))
        .png({ compressionLevel: 9, palette: true })
        .toFile(outputPath);
    }
  }
}

console.log("Generated editorial social cards");
