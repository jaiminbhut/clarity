/**
 * Server-side proxy to Sarvam AI speech-to-text for freestyle sessions.
 *
 * The client POSTs one raw 16kHz/16-bit/mono WAV clip (<30s, Sarvam's REST
 * cap; the client splits longer recordings) with `?language=en-IN` or
 * `?language=hi-IN`, and gets back `{ transcript }`. The Sarvam key stays
 * here, never in the app bundle.
 *
 * `verbatim` mode is the point of the exercise: the default mode normalizes the
 * transcript, which drops exactly the hesitations freestyle scores on.
 */

const SARVAM_URL = "https://api.sarvam.ai/speech-to-text";

/** 30s of 16kHz 16-bit mono PCM plus a header, with a little slack. */
const MAX_BODY_BYTES = 1_000_000;

const REQUEST_TIMEOUT_MS = 25_000;

/** `?language=` values, as Sarvam language codes. */
const LANGUAGES = new Set(["en-IN", "hi-IN"]);

export async function POST(request: Request) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Transcription has not been configured yet." },
      { status: 503 },
    );
  }

  const language = new URL(request.url).searchParams.get("language") ?? "en-IN";
  if (!LANGUAGES.has(language)) {
    return Response.json({ error: "Unsupported language." }, { status: 400 });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return Response.json({ error: "Audio clip is too long." }, { status: 413 });
  }

  const audio = new Uint8Array(await request.arrayBuffer().catch(() => new ArrayBuffer(0)));
  const isWav =
    audio.length > 44 &&
    String.fromCharCode(...audio.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...audio.subarray(8, 12)) === "WAVE";
  if (!isWav || audio.length > MAX_BODY_BYTES) {
    return Response.json({ error: "Expected a short WAV clip." }, { status: 400 });
  }

  const form = new FormData();
  form.append("file", new Blob([audio], { type: "audio/wav" }), "clip.wav");
  form.append("model", process.env.SARVAM_STT_MODEL || "saaras:v3");
  form.append("mode", "verbatim");
  form.append("language_code", language);

  try {
    const response = await fetch(SARVAM_URL, {
      method: "POST",
      headers: { "api-subscription-key": apiKey },
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[transcribe] Sarvam returned HTTP ${response.status}`);
      return Response.json(
        { error: "Transcription is unavailable right now." },
        { status: response.status === 429 ? 429 : 502 },
      );
    }

    const payload: unknown = await response.json();
    const transcript =
      payload && typeof payload === "object" && "transcript" in payload
        ? payload.transcript
        : null;
    if (typeof transcript !== "string") {
      console.error("[transcribe] Sarvam response had no transcript");
      return Response.json(
        { error: "Transcription is unavailable right now." },
        { status: 502 },
      );
    }

    return Response.json({ transcript });
  } catch (error) {
    console.error(
      "[transcribe] request failed:",
      error instanceof Error ? error.message : error,
    );
    return Response.json(
      { error: "Transcription is unavailable right now." },
      { status: 502 },
    );
  }
}
