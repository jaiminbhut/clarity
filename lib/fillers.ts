/**
 * Filler lexicon shared by the passage aligner (fillers = final-committed
 * insertions vs the reference) and the freestyle session (fillers = matches
 * in the raw final transcript, since there is no reference text).
 *
 * SCORED fillers are only the words that are almost never load-bearing. The
 * list used to also include `like`, `so`, `right`, `well`, `okay` and `anyway`,
 * counted with no syntactic context at all. In freestyle that meant "I like
 * coffee", "that's right" and "well water" each registered as a disfluency, and
 * `fillerScore` reaches zero at ten per minute, so an ordinary speaker lost most
 * of a whole skill to normal English.
 *
 * Those words are still tracked, as DISCOURSE_MARKERS, and still reported. They
 * are simply not scored: a count we cannot stand behind should not move a
 * number the user is judged by. Distinguishing a genuine filler `so` from a
 * connective `so` needs syntax we do not have here.
 *
 * PURE module: runs under bun for self-tests.
 */

/**
 * Hesitation sounds and stock filler phrases. A speaker never means one of
 * these, which is what makes counting them safe without context.
 */
export const FILLER_UNIGRAMS = new Set([
  'um',
  'umm',
  'uh',
  'uhh',
  'uhm',
  'er',
  'err',
  'ah',
  'ahh',
  'hmm',
  'hm',
  'mmm',
  // Intensifier-only in practice: they modify nothing and drop without loss.
  'basically',
  'literally',
  'actually',
  // Hindi hesitation sounds, as a hi-IN recognizer spells them (already in
  // `normalizeToken` form: chandrabindu folded to anusvara). `हम` is NOT here:
  // it is the word "we".
  'अं',
  'अम',
  'अम्म',
  'उम',
  'उम्म',
  'उह',
  'हम्म',
  'एं',
]);

export const FILLER_BIGRAMS = new Set([
  'you know',
  'i mean',
  'sort of',
  'kind of',
  // "I mean", the stock Hindi filler phrase.
  'मेरा मतलब',
]);

/**
 * Words that are fillers in some positions and ordinary vocabulary in others.
 * Counted and shown, never scored. See the module note.
 */
export const DISCOURSE_MARKERS = new Set([
  'like',
  'so',
  'right',
  'well',
  'okay',
  'ok',
  'anyway',
  // Hindi words that often fill ("I mean", "that is", "okay…") but are just as
  // often meaning-bearing. Counted and shown, never scored. The very common
  // particles that also fill (`तो`, `ना`, `वो`) are left out on purpose: they
  // are grammar far more often than filler, and counting them would make every
  // Hindi speaker look hesitant.
  'मतलब',
  'यानी',
  'अच्छा',
]);

/** Count scored fillers in normalized tokens — greedy bigrams first, then
 * unigrams (the same rule the aligner applies to insertion runs). */
export function countFillers(norms: readonly string[]): number {
  let count = 0;
  let i = 0;
  while (i < norms.length) {
    if (i + 1 < norms.length && FILLER_BIGRAMS.has(`${norms[i]} ${norms[i + 1]}`)) {
      count++;
      i += 2;
    } else {
      if (FILLER_UNIGRAMS.has(norms[i])) count++;
      i += 1;
    }
  }
  return count;
}

/** Count ambiguous discourse markers. Reported, not scored. A marker inside a
 * scored filler phrase ("मेरा मतलब") is already counted as that filler, so it
 * is skipped here rather than counted twice. */
export function countDiscourseMarkers(norms: readonly string[]): number {
  let count = 0;
  let i = 0;
  while (i < norms.length) {
    if (i + 1 < norms.length && FILLER_BIGRAMS.has(`${norms[i]} ${norms[i + 1]}`)) {
      i += 2;
      continue;
    }
    if (DISCOURSE_MARKERS.has(norms[i])) count++;
    i += 1;
  }
  return count;
}
