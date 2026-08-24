import { createHash } from "node:crypto";

import { parseFrontmatter } from "@astrojs/markdown-remark";

const sentenceEnd = /[.!?…]["')\]]?$/;
const pacingMarkerPattern = /\uE000audio-pause:([0-9]+(?:\.[0-9]+)?)\uE001/g;
const v3OnlyAudioTagPattern =
  /\[(?:short pause|long pause|pause|whispers?|shouts?|sighs?|exhales?|laughs(?: harder)?|starts laughing|wheezing|sarcastic|curious|excited|crying|snorts?|mischievously|giggling|dramatically|delighted|amazed)\]/i;

const pacingMarker = (seconds) =>
  `\uE000audio-pause:${Number(seconds).toFixed(1)}\uE001`;

const parsePauseDuration = (value) => {
  const seconds = Number(value);

  if (!Number.isFinite(seconds) || seconds < 0.1 || seconds > 3) {
    throw new Error(
      "Audio pause directives must be between 0.1 and 3 seconds.",
    );
  }

  return seconds;
};

const finishSentence = (value) => {
  const text = value.trim();

  if (!text || sentenceEnd.test(text)) return text;

  return `${text}.`;
};

const decodeEntities = (value) =>
  value
    .replaceAll("&amp;", "and")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&lt;", "less than")
    .replaceAll("&gt;", "greater than")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&mdash;", "—")
    .replaceAll("&ndash;", "–");

const mermaidNarration = (source) => {
  const title = source.match(/^\s*accTitle\s*:\s*(.+?)\s*$/m)?.[1];
  const inlineDescription = source.match(
    /^\s*accDescr\s*:\s*([^\s{].*?)\s*$/m,
  )?.[1];
  const blockDescription = source.match(
    /^\s*accDescr\s*\{\s*\n?([\s\S]*?)\n?\s*\}/m,
  )?.[1];
  const description = inlineDescription || blockDescription?.trim();

  if (!description) return "";

  return [
    title && finishSentence(title.replace(/^(["'])(.*)\1$/, "$2")),
    description,
  ]
    .filter(Boolean)
    .join(" ");
};

export function markdownToNarration(
  markdown,
  { includePacingMarkers = false } = {},
) {
  let text = markdown.replaceAll("\r\n", "\n");

  text = text.replace(
    /<!--\s*audio:skip:start\s*-->[\s\S]*?<!--\s*audio:skip:end\s*-->/gi,
    "\n\n",
  );
  text = text.replace(
    /<!--\s*audio:pause\s*:\s*([^>]*?)\s*-->/gi,
    (_, value) => {
      const seconds = parsePauseDuration(value.trim().replace(/s$/i, ""));
      return includePacingMarkers ? `\n\n${pacingMarker(seconds)}\n\n` : "\n\n";
    },
  );
  text = text.replace(/```mermaid\s*\n([\s\S]*?)```/gi, (_, source) => {
    const narration = mermaidNarration(source);
    return narration ? `\n\n${narration}\n\n` : "\n\n";
  });
  text = text.replace(/~~~mermaid\s*\n([\s\S]*?)~~~/gi, (_, source) => {
    const narration = mermaidNarration(source);
    return narration ? `\n\n${narration}\n\n` : "\n\n";
  });
  text = text.replace(/```[^\n]*\n[\s\S]*?```/g, "\n\n");
  text = text.replace(/~~~[^\n]*\n[\s\S]*?~~~/g, "\n\n");
  text = text.replace(/^[ \t]*(?:import|export)[ \t]+[^\n]+$/gm, "");
  text = text.replace(/<!--([\s\S]*?)-->/g, "");
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  text = text.replace(/!\[[^\]]*\]\[[^\]]*\]/g, "");
  text = text.replace(/^[ \t]*\[[^\]]+\]:[ \t]+\S+.*$/gm, "");
  text = text.replace(/\[([^\]]+)]\((?:[^()]|\([^)]*\))*\)/g, "$1");
  text = text.replace(/\[([^\]]+)]\[[^\]]*\]/g, "$1");
  text = text.replace(/\[\^([^\]]+)]/g, "");
  text = text.replace(/^[ \t]*\[\^[^\]]+\]:.*$/gm, "");
  text = text.replace(
    /^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm,
    (_, heading) => {
      const spokenHeading = finishSentence(heading);
      return includePacingMarkers
        ? `${spokenHeading} ${pacingMarker(0.8)}`
        : spokenHeading;
    },
  );
  text = text.replace(/^[ \t]{0,3}>[ \t]?/gm, "");
  text = text.replace(/^[ \t]*[-+*][ \t]+/gm, "");
  text = text.replace(/^[ \t]*\d+[.)][ \t]+/gm, "");
  text = text.replace(/^[ \t]*\|?(?:[ \t]*:?-+:?[ \t]*\|)+[ \t]*$/gm, "");
  text = text.replace(/\s*\|\s*/g, ", ");
  text = text.replace(
    /^[ \t]{0,3}(?:[-*_][ \t]*){3,}$/gm,
    includePacingMarkers ? `\n\n${pacingMarker(1.2)}\n\n` : "",
  );
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2");
  text = text.replace(/(^|[^*_])(\*|_)([^\n]+?)\2/g, "$1$3");
  text = text.replace(/<https?:\/\/[^>]+>/g, "");
  text = text.replace(/https?:\/\/\S+/g, "");
  text = text.replace(/<[^>]+>/g, "");
  text = text.replaceAll("→", " then ");
  text = text.replaceAll("←", " from ");
  text = text.replaceAll("↔", " and ");
  text = decodeEntities(text);
  text = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]*\n[ \t]*/g, " ").trim())
    .filter(Boolean)
    .join("\n\n");
  text = text.replace(/[ \t]{2,}/g, " ");

  return text.trim();
}

export function prepareNarrationForModel(narration, modelId) {
  const unsupportedTag = narration.match(v3OnlyAudioTagPattern)?.[0];

  if (modelId !== "eleven_v3" && unsupportedTag) {
    throw new Error(
      `${unsupportedTag} is an Eleven v3 audio tag and cannot be used with ${modelId}.`,
    );
  }

  return narration
    .replace(pacingMarkerPattern, (_, value) => {
      const seconds = parsePauseDuration(value);

      if (modelId === "eleven_v3") {
        if (seconds <= 0.8) return "[short pause]";
        if (seconds <= 1.5) return "[pause]";
        return "[long pause]";
      }

      return `<break time="${seconds.toFixed(1)}s" />`;
    })
    .trim();
}

export function createNarrationText(
  source,
  { modelId = "eleven_v3", pacing = true } = {},
) {
  const { content } = parseFrontmatter(source);

  const body = markdownToNarration(content, {
    includePacingMarkers: pacing,
  });

  if (!body) {
    throw new Error("The article produced an empty narration script.");
  }

  return prepareNarrationForModel(body, modelId);
}

const splitOversizedUnit = (unit, maxCharacters) => {
  const sentences = unit.split(/(?<=[.!?…]["')\]]?)\s+/).filter(Boolean);
  const pieces = [];
  let current = "";

  const pushCurrent = () => {
    if (current) pieces.push(current);
    current = "";
  };

  for (const sentence of sentences) {
    if (sentence.length > maxCharacters) {
      pushCurrent();
      const words = sentence.split(/\s+/);
      let wordChunk = "";

      for (const word of words) {
        const candidate = wordChunk ? `${wordChunk} ${word}` : word;

        if (candidate.length > maxCharacters && wordChunk) {
          pieces.push(wordChunk);
          wordChunk = word;
        } else {
          wordChunk = candidate;
        }
      }

      if (wordChunk) pieces.push(wordChunk);
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length > maxCharacters) {
      pushCurrent();
      current = sentence;
    } else {
      current = candidate;
    }
  }

  pushCurrent();

  return pieces;
};

export function splitNarration(text, maxCharacters = 9_000) {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 500) {
    throw new Error("Narration chunks must allow at least 500 characters.");
  }

  const units = text
    .split(/\n{2,}/)
    .flatMap((unit) =>
      unit.length > maxCharacters
        ? splitOversizedUnit(unit, maxCharacters)
        : [unit],
    )
    .filter(Boolean);
  const chunks = [];
  let current = "";

  for (const unit of units) {
    const candidate = current ? `${current}\n\n${unit}` : unit;

    if (candidate.length > maxCharacters && current) {
      chunks.push(current);
      current = unit;
    } else {
      current = candidate;
    }
  }

  if (current) chunks.push(current);

  if (chunks.some((chunk) => chunk.length > maxCharacters)) {
    throw new Error(
      "Unable to split narration within the ElevenLabs character limit.",
    );
  }

  return chunks;
}

export function sourceHash({ narration, voiceId, modelId, outputFormat }) {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify({ narration, voiceId, modelId, outputFormat }))
    .digest("hex")}`;
}

const removeTopLevelKey = (lines, key) => {
  const start = lines.findIndex((line) =>
    new RegExp(`^${key}\\s*:`).test(line),
  );

  if (start === -1) return lines;

  let end = start + 1;

  while (
    end < lines.length &&
    (lines[end].trim() === "" || /^[ \t]/.test(lines[end]))
  ) {
    end += 1;
  }

  lines.splice(start, end - start);

  return lines;
};

const setTopLevelScalar = (lines, key, value, { first = false } = {}) => {
  const index = lines.findIndex((line) =>
    new RegExp(`^${key}\\s*:`).test(line),
  );
  const line = `${key}: ${value}`;

  if (index === -1) {
    if (first) lines.unshift(line);
    else lines.push(line);
  } else {
    lines[index] = line;
  }

  return lines;
};

const quoted = (value) => JSON.stringify(value);

const serializeAudio = (audio) => [
  "audio:",
  `  provider: ${quoted(audio.provider)}`,
  `  storage: ${quoted(audio.storage)}`,
  `  url: ${quoted(audio.url)}`,
  `  mimeType: ${quoted(audio.mimeType)}`,
  `  byteLength: ${audio.byteLength}`,
  `  voiceId: ${quoted(audio.voiceId)}`,
  `  modelId: ${quoted(audio.modelId)}`,
  `  outputFormat: ${quoted(audio.outputFormat)}`,
  `  sourceHash: ${quoted(audio.sourceHash)}`,
  `  generatedAt: ${quoted(audio.generatedAt)}`,
];

export function upsertAudioFrontmatter(
  source,
  audio,
  { promote = false } = {},
) {
  const frontmatterMatch = source.match(
    /^(---\r?\n)([\s\S]*?)(\r?\n---)([\s\S]*)$/,
  );

  if (!frontmatterMatch) {
    throw new Error("Article source must begin with YAML frontmatter.");
  }

  const lineEnding = frontmatterMatch[1].includes("\r\n") ? "\r\n" : "\n";
  const lines = frontmatterMatch[2].split(/\r?\n/);

  removeTopLevelKey(lines, "audio");

  if (promote) {
    removeTopLevelKey(lines, "draft");
    setTopLevelScalar(lines, "layout", "../../layouts/ArticleLayout.astro", {
      first: true,
    });
  }

  while (lines.at(-1)?.trim() === "") lines.pop();
  lines.push(...serializeAudio(audio));

  return `${frontmatterMatch[1]}${lines.join(lineEnding)}${frontmatterMatch[3]}${frontmatterMatch[4]}`;
}

export function audioFilename(slug, hash) {
  const fingerprint = hash.replace(/^sha256:/, "").slice(0, 12);
  return `${slug}-${fingerprint}.mp3`;
}

export function maxCharactersForModel(modelId) {
  if (modelId === "eleven_v3") return 4_500;
  if (/flash|turbo/.test(modelId)) return 35_000;

  return 9_000;
}
