import {
  maxCharactersForModel,
  splitNarration,
} from "./article-publishing.mjs";

const continuityContextCharacters = 1_000;

export function continuityParametersForChunk({
  modelId,
  chunks,
  index,
  requestIds = [],
}) {
  const nextText = chunks[index + 1]?.slice(0, continuityContextCharacters);

  if (modelId === "eleven_v3") {
    return {};
  }

  return {
    ...(nextText ? { next_text: nextText } : {}),
    ...(requestIds.length
      ? { previous_request_ids: requestIds.slice(-3) }
      : {}),
  };
}

const generateChunk = async ({
  text,
  continuity,
  apiKey,
  voiceId,
  modelId,
  outputFormat,
}) => {
  const endpoint = new URL(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`,
  );
  endpoint.searchParams.set("output_format", outputFormat);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "audio/mpeg",
      "content-type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      apply_text_normalization: "auto",
      ...continuity,
    }),
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 800);
    const error = new Error(
      `ElevenLabs returned HTTP ${response.status}${details ? `: ${details}` : ""}`,
    );
    error.status = response.status;
    throw error;
  }

  const requestId = response.headers.get("request-id");
  const characterCost = response.headers.get("character-cost");
  const audio = Buffer.from(await response.arrayBuffer());

  if (audio.byteLength === 0) {
    throw new Error("ElevenLabs returned an empty audio response.");
  }

  return {
    audio,
    requestId,
    characterCost: characterCost ? Number(characterCost) : undefined,
  };
};

export const isRetryableElevenLabsError = (error) =>
  !Number.isInteger(error?.status) ||
  error.status === 429 ||
  error.status >= 500;

export async function generateElevenLabsAudio({
  narration,
  apiKey,
  voiceId,
  modelId,
  outputFormat,
  log = console.log,
  loadChunk,
  saveChunk,
}) {
  const chunks = splitNarration(narration, maxCharactersForModel(modelId));

  log(
    `Generating ${narration.length.toLocaleString("en-AU")} characters across ${chunks.length} ElevenLabs request${chunks.length === 1 ? "" : "s"}…`,
  );

  if (modelId === "eleven_v3" && chunks.length > 1) {
    log(
      "  Eleven v3: generating independent chunks for local MP3 concatenation (continuity context and request-ID stitching are unavailable).",
    );
  }

  const requestIds = [];
  let billedCharacters = 0;

  for (const [index, text] of chunks.entries()) {
    const cachedAudio = await loadChunk?.(index);

    if (cachedAudio) {
      log(`  Request ${index + 1} of ${chunks.length} (cached)`);
      continue;
    }

    log(`  Request ${index + 1} of ${chunks.length}`);
    const result = await generateChunk({
      text,
      continuity: continuityParametersForChunk({
        modelId,
        chunks,
        index,
        requestIds,
      }),
      apiKey,
      voiceId,
      modelId,
      outputFormat,
    });

    await saveChunk?.(index, result.audio);

    if (
      modelId !== "eleven_v3" &&
      index < chunks.length - 1 &&
      !result.requestId
    ) {
      throw new Error(
        "ElevenLabs did not return the request ID needed to stitch the next audio segment.",
      );
    }

    if (result.requestId) requestIds.push(result.requestId);
    if (result.characterCost) billedCharacters += result.characterCost;
  }

  if (billedCharacters) {
    log(
      `ElevenLabs reported ${billedCharacters.toLocaleString("en-AU")} billed characters.`,
    );
  }

  return {
    billedCharacters,
    chunkCount: chunks.length,
  };
}
