import { useMemo, useSyncExternalStore } from 'react';

import { languageOf } from '@/constants/accents';
import { textLanguage } from '@/lib/passage-text';
import { recommend, type RecommendationSet } from '@/lib/recommendations';
import {
  skillProfile,
  streak,
  todayProgress,
  topChallengingWords,
  weeklyHistory,
  wordsMastered,
  wordsToMaster,
} from '@/lib/stats';
import { getRecords, getWordStats, subscribe } from '@/services/session-history';
import { useSettings } from '@/hooks/use-settings';
import type { SessionRecord, SkillProfile, WordStat } from '@/types/history';

import { useNow } from './use-now';

/** All persisted session records, oldest first; re-renders on every save. */
export function useSessionRecords(): readonly SessionRecord[] {
  return useSyncExternalStore(subscribe, getRecords, getRecords);
}

/** Running per-word mastery aggregates. */
export function useWordStats(): readonly WordStat[] {
  return useSyncExternalStore(subscribe, getWordStats, getWordStats);
}

export type DerivedStats = {
  streak: number;
  /** Today's goal completion, 0–1. */
  todayProgress: number;
  /** Goal-met flags for the 5 days before today (WeeklyProgress's shape). */
  weeklyHistory: boolean[];
  skillProfile: SkillProfile;
};

/** Home/Practice-facing stats derived from the record store. `now` comes from the
 * shared clock, so these advance at midnight instead of freezing until the next
 * save. */
export function useDerivedStats(): DerivedStats {
  const records = useSessionRecords();
  const now = useNow();
  const { goalMinutes } = useSettings();
  return useMemo(
    () => ({
      streak: streak(records, now),
      todayProgress: todayProgress(records, now, goalMinutes),
      weeklyHistory: weeklyHistory(records, now, goalMinutes),
      skillProfile: skillProfile(records),
    }),
    [records, now, goalMinutes],
  );
}

/**
 * Words to practice and the count already mastered.
 *
 * Prefers the per-word aggregates, which know whether a word is actually
 * improving. Falls back to the per-session `challengingWords` when they're empty,
 * which is the case for ALL history written before the aggregates existed:
 * `recordWords` only runs on new sessions and nothing backfills migrated records,
 * so without this an upgrading user's "Words to master" section simply vanished
 * until they'd missed the same word in three fresh sessions.
 *
 * `mastered` has no such fallback on purpose — mastery is a claim about a word's
 * trend, and the old top-5 has no history to support it. It reads 0 until the
 * aggregates fill in, which is honest.
 */
export function useWords(count = 5): {
  toMaster: { word: string; count: number }[];
  mastered: number;
} {
  const stats = useWordStats();
  const records = useSessionRecords();
  const language = languageOf(useSettings().accentLocale);
  return useMemo(() => {
    // Rank everything, then keep the practice language's words: a Hindi
    // learner's "words to master" are Hindi words, and the generated practice
    // passage is written in the same language as the words it is given.
    const inLanguage = (list: { word: string; count: number }[]) =>
      list.filter((w) => textLanguage(w.word) === language).slice(0, count);
    const fromStats = inLanguage(wordsToMaster(stats, Number.MAX_SAFE_INTEGER));
    return {
      toMaster:
        fromStats.length > 0
          ? fromStats
          : inLanguage(topChallengingWords(records, Number.MAX_SAFE_INTEGER)),
      mastered: wordsMastered(stats),
    };
  }, [stats, records, count, language]);
}

/** Weakest-skill content picks for the Practice tab's Recommended section. */
export function useRecommendations(): RecommendationSet {
  const records = useSessionRecords();
  const { prioritySkill, accentLocale } = useSettings();
  const language = languageOf(accentLocale);
  return useMemo(
    () => recommend(records, skillProfile(records), prioritySkill, language),
    [records, prioritySkill, language],
  );
}
