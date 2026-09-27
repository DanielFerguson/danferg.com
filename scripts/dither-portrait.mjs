/**
 * Turns a photo into the site's four-colour dithered portrait style, the
 * source artwork HeroPortrait's shader expects (see dan-dark.png).
 *
 *   node scripts/dither-portrait.mjs <input> <output.png> \
 *     [--crop left,top,width,height] [--cells 380] [--local 0.55]
 *
 * The photo is reduced to `cells` columns, ranked by brightness and mapped
 * onto the dark palette so each colour covers about the same share of the
 * image as in the homepage portrait. Local contrast keeps faces readable when
 * the background is brighter than the subject. An ordered (Bayer) dither
 * blends neighbouring colours, and each cell is enlarged to 5x5 pixels.
 */
import sharp from "sharp";

const [input, output, ...flags] = process.argv.slice(2);
if (!input || !output) {
  console.error(
    "Usage: node scripts/dither-portrait.mjs <input> <output.png> [--crop l,t,w,h] [--cells 380] [--local 0.55]",
  );
  process.exit(1);
}
const flag = (name, fallback) => {
  const index = flags.indexOf(`--${name}`);
  return index === -1 ? fallback : flags[index + 1];
};

// Dark palette shared with src/scripts/hero-portrait-shader.ts.
const palette = [
  [0, 12, 56],
  [39, 34, 151],
  [78, 55, 246],
  [204, 102, 255],
];
// Share of each palette colour in the homepage portrait, darkest first.
const shares = [0.18, 0.6, 0.16, 0.06];
const bayer = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((value) => value / 16 + 1 / 32));
const CELL = 5;

const cells = Number(flag("cells", 380));
const local = Number(flag("local", 0.55));
const crop = flag("crop", "")
  .split(",")
  .filter(Boolean)
  .map(Number);

let image = sharp(input).removeAlpha();
if (crop.length === 4) {
  image = image.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
}
const small = await image
  .greyscale()
  .resize({ width: cells, kernel: "lanczos3" })
  // greyscale() keeps three identical channels; work on one.
  .extractChannel(0)
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = small.info;
if (channels !== 1) throw new Error(`Expected one channel, got ${channels}`);
const blurred = await sharp(small.data, { raw: { width, height, channels: 1 } })
  .blur(12)
  .extractChannel(0)
  .raw()
  .toBuffer();

// Blend overall brightness with local detail, then rank every cell.
const luminance = Float64Array.from(small.data, (value) => value / 255);
const detail = luminance.map((value, index) => value - blurred[index] / 255);
const maxDetail = Math.max(...detail.map(Math.abs)) || 1;
const tone = luminance.map(
  (value, index) => (1 - local) * value + local * (detail[index] / maxDetail / 2 + 0.5),
);
const order = [...tone.keys()].sort((a, b) => tone[a] - tone[b]);
const percentile = new Float64Array(tone.length);
order.forEach((cell, rank) => {
  percentile[cell] = rank / (tone.length - 1);
});

// Map percentiles onto a 0–3 ramp whose bands match the palette shares.
const edges = shares.reduce((acc, share) => [...acc, acc.at(-1) + share], [0]);
const stops = [0, 0.5, 1.5, 2.5, 3];
const ramp = (p) => {
  for (let band = 0; band < edges.length - 1; band += 1) {
    if (p <= edges[band + 1]) {
      const t = (p - edges[band]) / (edges[band + 1] - edges[band] || 1);
      return stops[band] + t * (stops[band + 1] - stops[band]);
    }
  }
  return 3;
};

const pixels = Buffer.alloc(width * CELL * height * CELL * 3);
for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const value = ramp(percentile[y * width + x]);
    const base = Math.floor(value);
    const level = Math.min(3, base + (value - base > bayer[y % 4][x % 4] ? 1 : 0));
    const colour = palette[level];
    for (let dy = 0; dy < CELL; dy += 1) {
      for (let dx = 0; dx < CELL; dx += 1) {
        const offset = ((y * CELL + dy) * width * CELL + x * CELL + dx) * 3;
        pixels[offset] = colour[0];
        pixels[offset + 1] = colour[1];
        pixels[offset + 2] = colour[2];
      }
    }
  }
}

await sharp(pixels, { raw: { width: width * CELL, height: height * CELL, channels: 3 } })
  .png({ palette: true, colours: 4, dither: 0, compressionLevel: 9, effort: 10 })
  .toFile(output);
console.log(`Wrote ${output} (${width * CELL}×${height * CELL})`);
