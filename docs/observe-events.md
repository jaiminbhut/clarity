# Observe event contract

The catalog is `services/observe-events.ts`. New custom events carry the global
`event_schema_version: 2` attribute. Filter by this version when comparing results:
older builds used different scoring and preview-completion semantics.

Every custom event has a random `eventId`. Deduplicate deliveries by that ID before
counting. The app also guards each operation against multiple terminal callbacks.
Old build 17 duplicates have no event ID and need separate treatment.

## Practice

- `practice.started` opens an attempt/checkpoint, including Results retries and
  manual restarts. It means a start was requested, not that permission was granted.
- `practice.ended` records the basic result, including deliberate stops and
  abandoned reads. `persisted` and `persistenceReason` distinguish saved results,
  silence, and storage failures.
- `practice.failed` records a terminal engine error in passage and freestyle.
- `practice.cancelled` records a deliberate discard before a result or failure.

Join these events by `attemptId`, not Observe's app-session ID. An attempt emits
at most one terminal event. A process kill may leave an unmatched start; recovering
its local history checkpoint on the next launch does not synthesize an Observe end.
A preview start also includes `previewId`, linking reservation to the practice
attempt even if the user leaves before requesting feedback.

`scoringSource: live` is the normal basic result, including sessions that later
receive Azure feedback. It does not measure Azure availability. The historical
`practice.scoring_degraded` name now only covers `processing-failed` in the basic
stop path. Recognition fallback and audio-processing warnings remain separate and
carry a mode. Their counts are diagnostics, not additional terminal attempts.

## Feedback

Both `assessment` and `coaching` have `.started`, `.completed`, `.failed`, and
`.cancelled` events. Join by `operationId`; retries create new operations. Events
also carry `attemptId`, `mode`, `preview`, and an optional `previewId`.

`durationMs` measures request-to-outcome elapsed time, including queueing and local
saving. A cancelled assessment means the UI stopped waiting; the provider request
may still finish. Coaching marks cached reads so they can be excluded from provider
latency analysis. Failures export bounded categories, never raw provider messages.

`pro.preview_requested`, `pro.preview_started`, and `pro.preview_failed` describe
preview reservation. `pro.preview_completed` means coaching became available after
any required pronunciation assessment. Reopening the same preview context in the
current app process does not count completion again. Telemetry IDs are ephemeral;
they are not backend session keys, grant IDs, or account IDs.

## Paywall and purchases

- `pro.feature_tapped` records an upgrade request from a locked feature.
- `pro.paywall_viewed` means the route opened. Use `pro.paywall_ready` as the
  denominator for impressions with loaded purchasable plans.
- `pro.paywall_failed` distinguishes an unavailable store, an empty offering, and
  an offering fetch failure. `pro.paywall_closed` distinguishes dismissal from
  verified unlock and includes whether plans loaded.
- `pro.purchase_started` / `pro.purchase_resolved` describe the store transaction.
  Outcomes are purchased, pending, failed, and cancelled.
- `pro.restore_started` / `pro.restore_resolved` describe restore attempts, including
  a successful restore with nothing to restore.
- `pro.verification_resolved` separates verified access, still-pending access, and
  verification failure. `pro.activated` follows verified access and identifies
  whether it came from purchase or restore; it is not a new-revenue event.
- `pro.purchase_blocked` records an account connection that was not ready for a
  purchase or restore action.

Join a visit by `paywallId` and an individual purchase/restore by `operationId`.
Source values are allowlisted. The unused legacy `paywall.resolved` helper was
removed; its historical data remains in Observe.

## Validation and delivery

Run `bun scripts/test-observe.tsx` for hook and catalog regressions, or `bun run test`
for the whole suite. These checks mock native delivery and never send events.

For device validation, use a development build with
`EXPO_PUBLIC_OBSERVE_IN_DEV=1` and Improve Clarity enabled. Exercise a practice retry,
a preview, paywall dismissal, purchase cancellation, and restore. Background the
app to flush, then inspect the schema-2 events in Observe. Release builds dispatch
normally when Improve Clarity is enabled. Exclude `practice_engine: mock` from
real-world scoring and recognition analysis. A release preview build is not
necessarily production customer usage; filter by build/update as well.
