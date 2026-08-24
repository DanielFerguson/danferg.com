import {
  access,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";

const exists = async (path) => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const removeIfPresent = async (path) => {
  try {
    await unlink(path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
};

export function audioChunkCacheKey(slug, modelId, hash) {
  const model = modelId.replaceAll("_", "-");
  const fingerprint = hash.replace(/^sha256:/, "").slice(0, 12);

  return `${slug}-${model}-${fingerprint}`;
}

export function createAudioChunkStore(root, key) {
  const directory = resolve(root, ".chunks", key);
  const pathFor = (index) =>
    resolve(directory, `${String(index + 1).padStart(2, "0")}.mp3`);

  return {
    directory,
    pathFor,
    paths: (count) =>
      Array.from({ length: count }, (_, index) => pathFor(index)),
    has: async (index) => {
      const path = pathFor(index);
      if (!(await exists(path))) return false;

      return (await stat(path)).size > 0;
    },
    load: async (index) => {
      const path = pathFor(index);
      if (!(await exists(path)) || (await stat(path)).size === 0) {
        return undefined;
      }

      return readFile(path);
    },
    save: async (index, audio) => {
      if (!audio?.byteLength) {
        throw new Error("Refusing to cache an empty ElevenLabs audio chunk.");
      }

      await mkdir(directory, { recursive: true });
      const finalPath = pathFor(index);
      const temporaryPath = `${finalPath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, audio);
      await rename(temporaryPath, finalPath);
    },
  };
}

export function requireFfmpeg() {
  const result = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });

  if (result.error || result.status !== 0) {
    throw new Error(
      "FFmpeg is required to losslessly assemble and validate article audio.",
    );
  }
}

const quoteConcatPath = (path) => path.replaceAll("'", "'\\''");

export async function assembleMp3({ chunkPaths, outputPath }) {
  if (!chunkPaths.length) {
    throw new Error("At least one audio chunk is required to assemble an MP3.");
  }

  for (const chunkPath of chunkPaths) {
    if (!(await exists(chunkPath)) || (await stat(chunkPath)).size === 0) {
      throw new Error(`The audio chunk ${chunkPath} is missing or empty.`);
    }
  }

  const outputDirectory = dirname(outputPath);
  await mkdir(outputDirectory, { recursive: true });

  const temporaryOutputPath = resolve(
    outputDirectory,
    `.${basename(outputPath)}.${process.pid}.mp3`,
  );
  const manifestPath = resolve(
    outputDirectory,
    `.${basename(outputPath)}.${process.pid}.ffconcat`,
  );
  const manifest = chunkPaths
    .map((path) => `file '${quoteConcatPath(path)}'`)
    .join("\n");

  try {
    await writeFile(
      manifestPath,
      `ffconcat version 1.0\n${manifest}\n`,
      "utf8",
    );

    const assembly = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        manifestPath,
        "-map",
        "0:a:0",
        "-c",
        "copy",
        "-f",
        "mp3",
        "-y",
        temporaryOutputPath,
      ],
      { encoding: "utf8" },
    );

    if (assembly.error) {
      throw new Error(`FFmpeg could not start: ${assembly.error.message}`);
    }
    if (assembly.status !== 0) {
      const details = assembly.stderr?.trim().slice(0, 800);
      throw new Error(
        `FFmpeg could not assemble the article MP3${details ? `: ${details}` : "."}`,
      );
    }

    const validation = spawnSync(
      "ffmpeg",
      ["-v", "error", "-i", temporaryOutputPath, "-f", "null", "-"],
      { encoding: "utf8" },
    );
    const validationErrors = validation.stderr?.trim() ?? "";

    if (validation.error || validation.status !== 0 || validationErrors) {
      throw new Error(
        `The assembled article MP3 failed validation${validationErrors ? `: ${validationErrors.slice(0, 800)}` : "."}`,
      );
    }

    const audio = await readFile(temporaryOutputPath);
    await rename(temporaryOutputPath, outputPath);

    return audio;
  } finally {
    await removeIfPresent(manifestPath);
    await removeIfPresent(temporaryOutputPath);
  }
}
