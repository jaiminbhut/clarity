import { z } from 'zod';
const score = z.number().finite().min(0).max(100);
export const assessmentInput = z.object({
  mode: z.enum(['passage', 'drill', 'freestyle']), durationMs: z.number().positive(),
  accuracy: score, fluency: score, completeness: score, intonation: score,
  paceWpm: z.number().min(0).max(500), targetWpm: z.number().positive().max(500),
  fillerCount: z.number().int().nonnegative(), spokenWords: z.number().int().nonnegative(),
  source: z.literal('azure'), pauseCount: z.number().int().nonnegative().optional(), longestPauseMs: z.number().nonnegative().optional(),
  wordCounts: z.object({ good: z.number().int().nonnegative(), mispronounced: z.number().int().nonnegative(), omitted: z.number().int().nonnegative(), inserted: z.number().int().nonnegative() }).strict(),
  challengingWords: z.array(z.string().max(64)).max(16),
  words: z.array(z.object({
    word: z.string().max(128), status: z.enum(['good', 'mispronounced', 'omitted', 'inserted']),
    score: score.optional(),
    phonemes: z.array(z.object({ phoneme: z.string().max(64), score: score.nullable(),
      heard: z.array(z.object({ phoneme: z.string().max(64), score })).max(5).optional() })).max(64).optional(),
    syllables: z.array(z.object({ syllable: z.string().max(128), grapheme: z.string().max(128).optional(), score: score.nullable() })).max(64).optional(),
    prosody: z.object({ unexpectedBreak: z.boolean().optional(), missingBreak: z.boolean().optional(), monotone: z.boolean().optional() }).optional(),
  }).strict()).max(2000),
}).strict();
