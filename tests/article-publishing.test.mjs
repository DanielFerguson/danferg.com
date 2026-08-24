import assert from "node:assert/strict";
import test from "node:test";

import { parseFrontmatter } from "@astrojs/markdown-remark";

import { audioChunkCacheKey } from "../scripts/lib/article-audio-files.mjs";
import {
  audioFilename,
  createNarrationText,
  markdownToNarration,
  maxCharactersForModel,
  prepareNarrationForModel,
  sourceHash,
  splitNarration,
  upsertAudioFrontmatter,
} from "../scripts/lib/article-publishing.mjs";
import { continuityParametersForChunk } from "../scripts/lib/elevenlabs-tts.mjs";

const article = `---
title: "A useful article"
description: "A description long enough for the content schema to accept."
date: "2026-08-24"
imageUrl: /image.png
canonicalUrl: /articles/a-useful-article
draft: true
---

This paragraph contains a [helpful link](https://example.com), **emphasis** and \`inline code\`.

![An image that should not be read](./image.png)

## A diagram

\`\`\`mermaid
flowchart LR
  accTitle: A useful flow
  accDescr: The first step leads to the second step.
  First --> Second
\`\`\`

\`\`\`js
const notForNarration = true;
\`\`\`

<!-- audio:skip:start -->
This production note must not be narrated.
<!-- audio:skip:end -->

The final result goes from effort → learning.
`;

test("turns article Markdown into clean spoken text", () => {
  const narration = createNarrationText(article);

  assert.match(narration, /^This paragraph contains/);
  assert.match(narration, /helpful link, emphasis and inline code/);
  assert.match(
    narration,
    /inline code\.\n\nA diagram\. \[short pause\]\n\nA useful flow\./,
  );
  assert.match(
    narration,
    /A useful flow\. The first step leads to the second step\./,
  );
  assert.match(narration, /effort then learning/);
  assert.doesNotMatch(
    narration,
    /A useful article|Written by Dan Ferguson|example\.com|notForNarration|production note|image that/,
  );
});

test("adds restrained model-aware pacing without rewriting the article", () => {
  const source = `---
title: "Paced article"
---

First paragraph.

<!-- audio:pause:1.4s -->

Second paragraph.

---

## Final section

Third paragraph.
`;
  const narration = createNarrationText(source);

  assert.equal(
    narration,
    [
      "First paragraph.",
      "[pause]",
      "Second paragraph.",
      "[pause]",
      "Final section. [short pause]",
      "Third paragraph.",
    ].join("\n\n"),
  );
  assert.equal(
    createNarrationText(source, { pacing: false }),
    [
      "First paragraph.",
      "Second paragraph.",
      "Final section.",
      "Third paragraph.",
    ].join("\n\n"),
  );
});

test("renders pacing for Eleven v3 and rejects its tags on v2", () => {
  assert.equal(
    prepareNarrationForModel(
      `A heading. \uE000audio-pause:0.8\uE001\n\nBody.`,
      "eleven_v3",
    ),
    "A heading. [short pause]\n\nBody.",
  );
  assert.throws(
    () =>
      prepareNarrationForModel(
        "[whispers] This should not be sent to v2.",
        "eleven_multilingual_v2",
      ),
    /Eleven v3 audio tag/,
  );
});

test("rejects pause directives outside ElevenLabs' supported range", () => {
  const source = `---\ntitle: "Invalid pause"\n---\n\nBefore.\n\n<!-- audio:pause:3.1s -->\n\nAfter.`;
  const malformedSource = source.replace("3.1s", "eventually");

  assert.throws(
    () => createNarrationText(source),
    /between 0\.1 and 3 seconds/,
  );
  assert.throws(
    () => createNarrationText(malformedSource),
    /between 0\.1 and 3 seconds/,
  );
});

test("keeps chunks inside the requested character limit", () => {
  const paragraph = `${"A complete sentence. ".repeat(90)}\n\n`;
  const chunks = splitNarration(paragraph.repeat(5), 700);

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 700));
  assert.equal(
    chunks.join("\n\n").replaceAll("\n\n", " ").split(/\s+/).length > 800,
    true,
  );
  assert.equal(maxCharactersForModel("eleven_v3"), 4_500);
});

test("uses a stable model-aware cache key for resumable audio chunks", () => {
  assert.equal(
    audioChunkCacheKey(
      "a-useful-article",
      "eleven_v3",
      "sha256:1234567890abcdef",
    ),
    "a-useful-article-eleven-v3-1234567890ab",
  );
});

test("omits unsupported continuity parameters across Eleven v3 chunks", () => {
  const chunks = [
    `First ${"a".repeat(1_100)}`,
    "Second chunk",
    `Third ${"z".repeat(1_100)}`,
  ];
  const context = continuityParametersForChunk({
    modelId: "eleven_v3",
    chunks,
    index: 1,
    requestIds: ["request-1"],
  });

  assert.deepEqual(context, {});
});

test("retains request-ID stitching for long-form v2 chunks", () => {
  const chunks = ["First chunk", "Second chunk", "Third chunk"];
  const context = continuityParametersForChunk({
    modelId: "eleven_multilingual_v2",
    chunks,
    index: 1,
    requestIds: ["request-1", "request-2", "request-3", "request-4"],
  });

  assert.deepEqual(context, {
    next_text: "Third chunk",
    previous_request_ids: ["request-2", "request-3", "request-4"],
  });
});

test("promotes a draft and records reproducible audio metadata", () => {
  const narration = markdownToNarration("A short article.");
  const hash = sourceHash({
    narration,
    voiceId: "voice-1",
    modelId: "eleven_v3",
    outputFormat: "mp3_44100_128",
  });
  const metadata = {
    provider: "elevenlabs",
    storage: "vercel-static",
    url: `/audio/articles/${audioFilename("a-useful-article", hash)}`,
    mimeType: "audio/mpeg",
    byteLength: 1234,
    voiceId: "voice-1",
    modelId: "eleven_v3",
    outputFormat: "mp3_44100_128",
    sourceHash: hash,
    generatedAt: "2026-08-24T01:02:03.000Z",
  };
  const updated = upsertAudioFrontmatter(article, metadata, { promote: true });
  const { frontmatter } = parseFrontmatter(updated);

  assert.equal(frontmatter.draft, undefined);
  assert.equal(frontmatter.layout, "../../layouts/ArticleLayout.astro");
  assert.deepEqual(frontmatter.audio, metadata);
  assert.match(updated, /This paragraph contains/);
});

test("changes the source hash when the selected voice changes", () => {
  const common = {
    narration: "The same article.",
    modelId: "eleven_v3",
    outputFormat: "mp3_44100_128",
  };

  assert.notEqual(
    sourceHash({ ...common, voiceId: "voice-1" }),
    sourceHash({ ...common, voiceId: "voice-2" }),
  );
});
