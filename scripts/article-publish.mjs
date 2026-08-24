import {
  access,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";

import { parseFrontmatter } from "@astrojs/markdown-remark";

import {
  assembleMp3,
  audioChunkCacheKey,
  createAudioChunkStore,
  requireFfmpeg,
} from "./lib/article-audio-files.mjs";
import {
  audioFilename,
  createNarrationText,
  maxCharactersForModel,
  sourceHash,
  splitNarration,
  upsertAudioFrontmatter,
} from "./lib/article-publishing.mjs";
import {
  generateElevenLabsAudio,
  isRetryableElevenLabsError,
} from "./lib/elevenlabs-tts.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const publishedRoot = resolve(projectRoot, "src/pages/articles");
const draftsRoot = resolve(projectRoot, "src/content/drafts/articles");
const publicAudioRoot = resolve(projectRoot, "public/audio/articles");
const artifactAudioRoot = resolve(projectRoot, ".artifacts/article-audio");

const args = process.argv.slice(2);
const slug = args.find((argument) => !argument.startsWith("--"));
const dryRun = args.includes("--dry-run");
const forceAudio = args.includes("--force-audio");

const fail = (message) => {
  console.error(`\nArticle publication stopped: ${message}\n`);
  process.exit(1);
};

if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  fail(
    "provide a clean article slug, for example `npm run article:publish -- when-doing-nothing-starts-to-feel-wrong`.",
  );
}

const exists = async (path) => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const findArticle = async () => {
  const matches = [];

  for (const extension of [".md", ".mdx"]) {
    const publishedPath = resolve(publishedRoot, `${slug}${extension}`);
    const draftPath = resolve(draftsRoot, `${slug}${extension}`);

    if (await exists(publishedPath)) {
      matches.push({ path: publishedPath, published: true });
    }
    if (await exists(draftPath)) {
      matches.push({ path: draftPath, published: false });
    }
  }

  if (matches.length === 0) {
    fail(`no Markdown or MDX article named ${slug} was found.`);
  }
  if (matches.length > 1) {
    fail(`more than one draft or published source exists for ${slug}.`);
  }

  return matches[0];
};

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error || result.status !== 0) {
    fail(`${command} ${commandArgs.join(" ")} failed.`);
  }
};

const writeTextAtomic = async (path, content) => {
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, path);
};

const article = await findArticle();
const originalSource = await readFile(article.path, "utf8");
const { frontmatter } = parseFrontmatter(originalSource);
const existingAudio = frontmatter.audio;
const voiceId = process.env.ELEVENLABS_VOICE_ID || existingAudio?.voiceId;
const modelId =
  process.env.ELEVENLABS_MODEL_ID || existingAudio?.modelId || "eleven_v3";
const outputFormat =
  process.env.ELEVENLABS_OUTPUT_FORMAT ||
  existingAudio?.outputFormat ||
  "mp3_44100_128";
const narration = createNarrationText(originalSource, { modelId });
const chunks = splitNarration(narration, maxCharactersForModel(modelId));
const pacingCueCount =
  narration.match(
    modelId === "eleven_v3"
      ? /\[(?:short pause|pause|long pause)\]/g
      : /<break time="[0-9]+(?:\.[0-9]+)?s" \/>/g,
  )?.length ?? 0;

if (
  !/^mp3_(?:22050_32|24000_48|44100_(?:32|64|96|128|192))$/.test(outputFormat)
) {
  fail(
    `ELEVENLABS_OUTPUT_FORMAT must be a supported MP3 format; received ${outputFormat}.`,
  );
}

console.log(`\nArticle: ${frontmatter.title}`);
console.log(
  `Source: ${article.published ? "published article" : "local draft"}`,
);
console.log(
  `Narration: ${narration.length.toLocaleString("en-AU")} characters, ${narration.split(/\s+/).length.toLocaleString("en-AU")} words`,
);
console.log(
  `Pacing: ${pacingCueCount.toLocaleString("en-AU")} model-aware cue${pacingCueCount === 1 ? "" : "s"}`,
);
console.log(
  `ElevenLabs: ${modelId}, ${outputFormat}, ${chunks.length} request${chunks.length === 1 ? "" : "s"}`,
);
if (modelId === "eleven_v3" && chunks.length > 1) {
  console.log(
    "Continuity: natural-boundary chunks, resumable local cache, and lossless MP3 assembly.",
  );
}

if (dryRun) {
  console.log("\nDry run complete. No API request or file change was made.\n");
  process.exit(0);
}

if (!voiceId) {
  fail(
    "set ELEVENLABS_VOICE_ID in .env after choosing or creating your ElevenLabs voice.",
  );
}

const hash = sourceHash({ narration, voiceId, modelId, outputFormat });
const filename = audioFilename(slug, hash);
const finalAudioPath = resolve(publicAudioRoot, filename);
const audioUrl = `/audio/articles/${filename}`;
const canonicalCacheKey = audioChunkCacheKey(slug, modelId, hash);
const generationCacheKey = forceAudio
  ? `${canonicalCacheKey}-force-${Date.now()}`
  : canonicalCacheKey;
const canonicalChunkStore = createAudioChunkStore(
  artifactAudioRoot,
  canonicalCacheKey,
);
const generationChunkStore = createAudioChunkStore(
  artifactAudioRoot,
  generationCacheKey,
);
const existingLocalUrl =
  typeof existingAudio?.url === "string" &&
  /^\/audio\/articles\/[a-z0-9-]+\.mp3$/.test(existingAudio.url)
    ? existingAudio.url
    : undefined;
const existingLocalPath = existingLocalUrl
  ? resolve(publicAudioRoot, basename(existingLocalUrl))
  : undefined;
const existingAudioIsCurrent =
  !forceAudio &&
  existingAudio?.sourceHash === hash &&
  existingLocalPath &&
  existingLocalPath === finalAudioPath &&
  (await exists(existingLocalPath));

let audio;

if (existingAudioIsCurrent) {
  audio = await readFile(existingLocalPath);
  console.log(
    "The existing MP3 matches the article and voice settings; generation skipped.",
  );
} else {
  let cachedChunkCount = 0;

  if (modelId === "eleven_v3" && !forceAudio) {
    const cached = await Promise.all(
      chunks.map((_, index) => generationChunkStore.has(index)),
    );
    cachedChunkCount = cached.filter(Boolean).length;

    if (cachedChunkCount) {
      console.log(
        `Resume cache: ${cachedChunkCount} of ${chunks.length} audio chunks ready.`,
      );
    }
  }

  const needsApi =
    forceAudio || modelId !== "eleven_v3" || cachedChunkCount < chunks.length;

  if (needsApi && !process.env.ELEVENLABS_API_KEY) {
    fail("set ELEVENLABS_API_KEY in .env before generating the MP3.");
  }

  try {
    requireFfmpeg();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  console.log(
    "\nRunning the production preflight before using ElevenLabs credits…",
  );
  run("npm", ["test"]);
  run("npm", ["run", "build"]);

  let generated;
  let reuseCachedChunks = modelId === "eleven_v3" && !forceAudio;

  for (let pass = 1; pass <= 2; pass += 1) {
    try {
      generated = await generateElevenLabsAudio({
        narration,
        apiKey: process.env.ELEVENLABS_API_KEY,
        voiceId,
        modelId,
        outputFormat,
        loadChunk: reuseCachedChunks ? generationChunkStore.load : undefined,
        saveChunk: generationChunkStore.save,
      });
      break;
    } catch (error) {
      if (
        pass === 2 ||
        modelId !== "eleven_v3" ||
        !isRetryableElevenLabsError(error)
      ) {
        fail(error instanceof Error ? error.message : String(error));
      }

      console.log(
        `  A v3 stream was interrupted (${error instanceof Error ? error.message : String(error)}). Retrying only the missing chunk…`,
      );
      reuseCachedChunks = true;
    }
  }

  if (!generated) {
    fail("ElevenLabs did not return all article audio chunks.");
  }

  try {
    audio = await assembleMp3({
      chunkPaths: generationChunkStore.paths(chunks.length),
      outputPath: finalAudioPath,
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  if (forceAudio) {
    for (const index of chunks.keys()) {
      const chunk = await generationChunkStore.load(index);
      await canonicalChunkStore.save(index, chunk);
    }
  }
}

const metadata = {
  provider: "elevenlabs",
  storage: "vercel-static",
  url: audioUrl,
  mimeType: "audio/mpeg",
  byteLength: audio.byteLength,
  voiceId,
  modelId,
  outputFormat,
  sourceHash: hash,
  generatedAt: existingAudioIsCurrent
    ? existingAudio.generatedAt
    : new Date().toISOString(),
};
const updatedSource = upsertAudioFrontmatter(originalSource, metadata, {
  promote: !article.published,
});
let publishedPath = article.path;

if (article.published) {
  await writeTextAtomic(article.path, updatedSource);
} else {
  publishedPath = resolve(publishedRoot, basename(article.path));

  if (await exists(publishedPath)) {
    fail(`the publication target ${publishedPath} already exists.`);
  }

  await mkdir(publishedRoot, { recursive: true });
  await writeTextAtomic(publishedPath, updatedSource);
  await unlink(article.path);
  console.log(`Promoted ${basename(article.path)} into src/pages/articles/.`);
}

if (
  existingLocalPath &&
  existingLocalPath !== finalAudioPath &&
  existingLocalPath.startsWith(`${publicAudioRoot}/`) &&
  (await exists(existingLocalPath))
) {
  await unlink(existingLocalPath);
  console.log(`Removed superseded audio ${basename(existingLocalPath)}.`);
}

console.log(
  `${existingAudioIsCurrent ? "Using" : "Saved"} ${(audio.byteLength / 1_048_576).toFixed(1)} MB at ${audioUrl}.`,
);
console.log("\nBuilding and auditing the publication…");
run("npm", ["run", "build"]);

console.log("\nArticle publication is ready for review.");
console.log(`Source: ${publishedPath}`);
console.log(`Audio: ${audioUrl}`);
console.log("Listen locally before committing and pushing the changes.\n");
