import { generateObject, generateSpeech, gateway, streamObject } from 'ai';
import { z } from 'zod';
import { ConvexError } from 'convex/values';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';
import { refreshCaller } from './billing';
import { requireUserId } from './lib';
import { readBoundedBody } from './requestBody';
import { wavDuration } from './proPolicy';
import type { PremiumFeature } from './proPolicy';
import * as coach from './coachPrompt';
import * as passage from './passagePrompt';

const wordSchema = z.object({ word: z.string().trim().min(1).max(40), locale: z.enum(['en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN']).default('en-US') }).strict();
const locales = new Set(['en-US', 'en-GB', 'en-AU', 'en-CA', 'en-IN']);
const errors: Record<string, [number, string]> = {
  account_deleting: [403, 'Account deletion has started. Finish deleting your account in Settings.'],
  authentication_required: [401, 'Sign in to use personal feedback.'], upgrade_required: [403, 'Clarity Pro unlocks this feature.'],
  preview_exhausted: [403, 'Your free feedback allowance has been used. Basic practice is always available.'],
  preview_expired: [403, 'Start a new free feedback session.'], processing: [202, 'Your feedback is processing.'],
  temporarily_throttled: [429, 'Please wait a moment and try again.'], billing_unavailable: [503, 'We could not verify your subscription. Please try again.'],
  invalid_request: [400, 'This request could not be processed.'], operation_conflict: [409, 'This request changed. Start a new request.'],
  provider_failure: [502, 'Personal feedback is temporarily unavailable. Your basic results are saved.'],
};
export function errorResponse(error: unknown) {
  const code = error instanceof ConvexError && typeof error.data === 'string' ? error.data : error instanceof Error ? error.message : 'provider_failure';
  const known = errors[code] ? code : 'provider_failure';
  const [status, message] = errors[known];
  return Response.json({ code: known, error: message }, { status, headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' } });
}
async function hash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}
const textHash = (text: string) => hash(new TextEncoder().encode(text));
function header(request: Request, name: string, max = 128) {
  const value = request.headers.get(name) ?? '';
  if (!value || value.length > max) throw new Error('invalid_request');
  return value;
}
export async function processPremium(ctx: ActionCtx, request: Request, feature: Exclude<PremiumFeature, 'analytics'>): Promise<Response> {
  let reservation: { id: Id<'premiumOperations'>; attempt: number } | undefined;
  try {
    try { await requireUserId(ctx); } catch { throw new Error('authentication_required'); }
    const operation = header(request, 'X-Operation-Id');
    const sessionKey = header(request, 'X-Session-Key');
    const grantId = request.headers.get('X-Preview-Id') as Id<'previewGrants'> | null;
    const bytes = await readBoundedBody(request, feature === 'assessment' ? 950_000 : 20_000);
    let parsed: unknown;
    let durationMs = 0;
    let audioKey = '';
    let reference = '';
    let locale = 'en-US';
    if (feature === 'assessment') {
      try { durationMs = wavDuration(bytes, true); } catch { throw new Error('invalid_request'); }
      reference = decodeURIComponent(header(request, 'X-Reference-Text', 16_000));
      locale = header(request, 'X-Accent-Locale');
      if (!locales.has(locale) || reference.length > 4_000) throw new Error('invalid_request');
    } else {
      try {
        const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
        parsed = feature === 'coach' ? coach.requestSchema.parse(body) : feature === 'exercise' ? passage.requestSchema.parse(body) : wordSchema.parse(body);
      } catch { throw new Error('invalid_request'); }
      if (feature === 'coach') durationMs = (parsed as z.infer<typeof coach.requestSchema>).stats.durationSeconds * 1000;
      if (feature === 'pronunciation') {
        const word = parsed as z.infer<typeof wordSchema>;
        audioKey = `${word.word.toLocaleLowerCase('en')}|${word.locale}|alloy|${process.env.AI_TTS_MODEL || 'openai/tts-1'}|v1`;
      }
    }
    await refreshCaller(ctx);
    const fingerprint = audioKey ? await textHash(audioKey) : await textHash(`${await hash(bytes)}|${reference}|${locale}`);
    const key = feature === 'pronunciation' ? `pronunciation:${fingerprint}` : `${feature}:${operation}`;
    const reserved = await ctx.runMutation(internal.pro.reserve, { key, fingerprint, sessionKey, feature, durationMs, ...(grantId ? { grantId } : {}) });
    reservation = reserved;
    if (reserved.cached) {
      console.info(JSON.stringify({ event: 'premium.cache_hit', feature }));
      if (reserved.audioId) {
        const blob = await ctx.storage.get(reserved.audioId);
        if (!blob) throw new Error('provider_failure');
        return new Response(blob, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400' } });
      }
      return new Response(reserved.result, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
    }
    const finish = async (result: string | undefined, extra: { audioId?: Id<'_storage'>; inputTokens?: number; outputTokens?: number; characters?: number; estimatedCost?: number } = {}) => {
      await ctx.runMutation(internal.pro.finish, { id: reserved.id, attempt: reserved.attempt, success: true, ...(result ? { result } : {}), ...extra });
    };
    if (feature === 'assessment') {
      const key = process.env.AZURE_SPEECH_KEY;
      const region = process.env.AZURE_SPEECH_REGION;
      if (!key || !region || !/^[a-z0-9-]+$/.test(region)) throw new Error('provider_failure');
      const params = { ReferenceText: reference, GradingSystem: 'HundredMark', Granularity: 'Phoneme', PhonemeAlphabet: 'IPA', NBestPhonemeCount: 5,
        Dimension: 'Comprehensive', EnableMiscue: true, EnableProsodyAssessment: locale === 'en-US' };
      const encoded = btoa(Array.from(new TextEncoder().encode(JSON.stringify(params)), b => String.fromCharCode(b)).join(''));
      const response = await fetch(`https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed`, {
        method: 'POST', body: bytes, headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'audio/wav', 'Pronunciation-Assessment': encoded },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error('provider_failure');
      const result = await response.json();
      if (result.RecognitionStatus !== 'Success' || !result.NBest?.length) throw new Error('provider_failure');
      const rate = Number(process.env.AZURE_ASSESSMENT_USD_PER_HOUR);
      await finish(JSON.stringify(result), Number.isFinite(rate) && rate > 0 ? { estimatedCost: durationMs / 3_600_000 * rate } : {});
      return Response.json(result);
    }
    if (!process.env.AI_GATEWAY_API_KEY) throw new Error('provider_failure');
    if (feature === 'coach') {
      const data = parsed as z.infer<typeof coach.requestSchema>;
      const generated = streamObject({ model: process.env.AI_COACH_MODEL || 'google/gemini-3.5-flash-lite', system: coach.SYSTEM_PROMPT,
        prompt: `Create coaching tips for this session:\n${JSON.stringify(data.stats)}`, schema: coach.coachingSchema, maxOutputTokens: 500, maxRetries: 2,
        abortSignal: AbortSignal.timeout(45_000) });
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const text of generated.textStream) controller.enqueue(new TextEncoder().encode(text));
            const object = await generated.object;
            const usage = await generated.usage;
            await finish(JSON.stringify(object), { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0,
              estimatedCost: (usage.inputTokens ?? 0) * Number(process.env.AI_INPUT_USD_PER_MILLION || '0.30') / 1e6 +
                (usage.outputTokens ?? 0) * Number(process.env.AI_OUTPUT_USD_PER_MILLION || '2.50') / 1e6 });
            controller.close();
          } catch {
            await ctx.runMutation(internal.pro.finish, { id: reserved.id, attempt: reserved.attempt, success: false });
            controller.error(new Error('provider_failure'));
          }
        },
      });
      return new Response(stream, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    }
    if (feature === 'exercise') {
      const data = parsed as z.infer<typeof passage.requestSchema>;
      const generated = await generateObject({ model: process.env.AI_PASSAGE_MODEL || 'google/gemini-3.5-flash-lite', system: passage.SYSTEM_PROMPT,
        prompt: `Target words: ${JSON.stringify(data.words)}`, schema: passage.passageSchema, maxOutputTokens: 600, maxRetries: 2, abortSignal: AbortSignal.timeout(45_000) });
      await finish(JSON.stringify(generated.object), { inputTokens: generated.usage.inputTokens ?? 0, outputTokens: generated.usage.outputTokens ?? 0,
        estimatedCost: (generated.usage.inputTokens ?? 0) * Number(process.env.AI_INPUT_USD_PER_MILLION || '0.30') / 1e6 +
          (generated.usage.outputTokens ?? 0) * Number(process.env.AI_OUTPUT_USD_PER_MILLION || '2.50') / 1e6 });
      return Response.json(generated.object);
    }
    const word = parsed as z.infer<typeof wordSchema>;
    let audioId = await ctx.runQuery(internal.pro.cachedAudio, { key: audioKey });
    let generated = false;
    if (!audioId) {
      const { audio } = await generateSpeech({ model: gateway.speech(process.env.AI_TTS_MODEL || 'openai/tts-1'), text: word.word,
        voice: 'alloy', outputFormat: 'mp3', speed: 0.9, maxRetries: 2, abortSignal: AbortSignal.timeout(45_000) });
      audioId = await ctx.storage.store(new Blob([new Uint8Array(audio.uint8Array)], { type: 'audio/mpeg' }));
      generated = true;
      await ctx.runMutation(internal.pro.cacheAudio, { key: audioKey, audioId });
    }
    await finish(undefined, { audioId, characters: generated ? word.word.length : 0, estimatedCost: generated ? word.word.length * Number(process.env.TTS_USD_PER_MILLION_CHARACTERS || '15') / 1e6 : 0 });
    const audio = await ctx.storage.get(audioId);
    return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400' } });
  } catch (error) {
    if (reservation) await ctx.runMutation(internal.pro.finish, { ...reservation, success: false }).catch(() => {});
    return errorResponse(error);
  }
}
