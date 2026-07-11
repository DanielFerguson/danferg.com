import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const outputPath = resolve(projectRoot, "public/images/og-default.png");

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4f39f6" stroke-opacity="0.075" stroke-width="1"/>
    </pattern>
    <linearGradient id="signal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4f39f6"/>
      <stop offset="1" stop-color="#1b1070"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="#f8f7fc"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect x="34" y="34" width="1132" height="562" fill="none" stroke="#1b1070" stroke-width="2"/>
  <rect x="34" y="34" width="1132" height="54" fill="#1b1070"/>

  <g font-family="SFMono-Regular, Consolas, Liberation Mono, monospace">
    <text x="68" y="69" fill="#f8f7fc" font-size="20" font-weight="700" letter-spacing="2">DANFERG.COM // PORTFOLIO</text>
    <circle cx="1096" cy="61" r="7" fill="#cc66ff"/>
    <text x="1120" y="69" fill="#f8f7fc" font-size="16" text-anchor="middle">LIVE</text>

    <text x="76" y="166" fill="#4f39f6" font-size="20" font-weight="700" letter-spacing="3">BUILDER / STRATEGIST / OPTIMIST</text>
    <text x="72" y="270" fill="#181d27" font-size="72" font-weight="800" letter-spacing="-4">Technology for problems</text>
    <text x="72" y="356" fill="#181d27" font-size="72" font-weight="800" letter-spacing="-4">that actually matter.</text>

    <rect x="72" y="426" width="1056" height="1" fill="#1b1070" fill-opacity="0.45"/>
    <text x="72" y="487" fill="#414651" font-size="25">Products, systems, and stories built around real human problems.</text>

    <rect x="72" y="531" width="70" height="45" fill="url(#signal)" transform="rotate(-3 107 553)"/>
    <text x="107" y="560" fill="#f8f7fc" font-size="18" font-weight="800" text-anchor="middle">D/F</text>
    <text x="168" y="560" fill="#1b1070" font-size="27" font-weight="800">DAN FERG</text>
    <text x="1128" y="560" fill="#717680" font-size="18" text-anchor="end">MELBOURNE, AUSTRALIA</text>
  </g>
</svg>`;

await mkdir(dirname(outputPath), { recursive: true });
await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9, palette: true })
  .toFile(outputPath);

console.log(`Generated ${outputPath}`);
