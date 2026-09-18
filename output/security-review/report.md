# Clarity security and TestFlight readiness review

Reviewed September 8–9, 2026 (America/Toronto / UTC), starting from commit `1dc6b38`. Fixes are in the working tree. Backend and web changes are deployed; no native build was uploaded by this review.

**Decision: not yet cleared for public TestFlight.** Confirmed security defects were fixed and checked, but the previously exposed Azure key has not been confirmed revoked, Apple subscription levels remain inconsistent, and the replacement native build needs real TestFlight acceptance testing. This is a source, configuration, dependency, endpoint and simulator review, not proof that no vulnerabilities exist.

## Confirmed findings and changes

| Finding | Risk before the fix | Change and evidence |
| --- | --- | --- |
| Account switching / remote sign-out retained account-owned local data and queued work | High: another account could see or upload the previous account's data | `AccountBoundary` unmounts account consumers before clearing stores; each owner gets a separate Convex transport; late generation/audio responses and retries check ownership. Actual boundary rendering tests cover revocation and direct account switching. Simulator sign-out and protected feedback deep-link checks pass. |
| Deleting server data could reset free allowances without deleting the identity | High: authenticated callers could repeatedly claim welcome previews; delayed writes/webhooks could recreate deleted data | A durable account-deletion marker blocks subsequent writes, provider actions and billing reconciliation. Deletion retries remain available. Cross-account access and deletion/regeneration tests pass. |
| Older retried operations escaped the active-operation concurrency count | Medium: concurrency and preview reservation races could increase provider usage | Active lease indexing replaces creation-time counting; preview reservations extend while processing runs. Regression tests cover old retries and near-expiry reservations. |
| Request bodies were not bounded before buffering | Medium: malformed/chunked requests could force excessive work | Shared streaming body limits, strict session-key validation, forwarding-header allowlist, timeout and consistent errors. WAV checks reject digital silence before provider work. |
| Malformed deep-link decoding could block the JS thread | Medium: reachable dependency denial of service | Backported the upstream linear decoder while retaining the CommonJS API expected by Expo Router. The real query-string dependency passes malformed-input timing and compatibility checks. See `dependency-review.md` and `../../patches/README.md`. |
| Production configuration could inherit local QA flags or credentials | High release risk | Production config now fails on QA/mock flags, public secrets, test Clerk keys, a missing App Store SDK key or the wrong Convex deployment. Production EAS variables were inspected. The exported iOS and web artifacts contain none of the known secret values scanned. |
| TestFlight receipts were rejected by the production backend | Release blocker for Pro testing | Explicit Apple-sandbox beta support is enabled on production; RevenueCat's production webhook now includes Sandbox. Test Store remains rejected, and sandbox purchases contribute no revenue. Disable the exception before paid App Store release. |
| Privacy diagnostics toggle had no effect | Privacy / trust issue | The preference now controls Expo Observe dispatch and follows synced settings changes. Sensitive purchase/session route parameters are filtered. Published privacy disclosures describe premium processing, cached audio, deletion markers and optional diagnostics. |
| Clean web deployments lacked an explicit backend origin | Availability issue | Added `CONVEX_SITE_URL` to EAS production rather than relying on local dotenv state. Published adapters were rechecked after deployment: all six missing/invalid-auth requests return 401. |

The sign-out device check also exposed duplicate RevenueCat logout calls. Cleanup now checks whether the SDK is already anonymous, making repeated cleanup harmless. The repeat sign-out reached the sign-in screen without that warning or a Convex closed-client error.

The Metro log also identified a circular import from `SectionHeader` through the UI barrel back to itself. It now imports `ThemedText` directly; the final type check passes.

## Validation

- `bun run typecheck`: both application and Convex programs pass.
- `bun run test`: **756 checks pass** (627 existing, 70 premium, 59 security).
- Expo Doctor: **21/21 checks pass** after recommended Expo patch updates.
- EAS validation: `.eas/workflows/deploy-to-testflight.yml` is valid. Type checks and regressions now gate both native builds and OTA updates.
- Live Convex endpoints: **32/32** missing/invalid-auth requests rejected with 401 across development and production. See `live-endpoints.json`.
- Published web adapters: **6/6** missing/invalid-auth requests rejected with 401. Privacy page returns 200 with the revised disclosures. See `web-validation.json`.
- Production iOS export succeeds; 36 output files scanned, no known server/local secret values found. Production web export: 41 files, no matches. A tracked-file credential-pattern scan also found no matches. These scans do not establish that arbitrary unknown secrets cannot exist.
- `git diff --check` passes.
- Dependency audit still reports four package names / five advisories. The reachable decoder issue is patched; the other affected paths were not found reachable by app users. Details and upstream sources are in `dependency-review.md`.
- Full React Doctor scan reports **11 errors and 96 warnings, 52/100**. The errors concern ref writes during render in existing session/sync/loading components; warnings include effect, performance and style suggestions. They were not all rewritten during this security review and are not all demonstrated runtime defects. Full output is saved in `react-doctor.txt`.

## Device evidence and limits

Used an isolated iPhone 17 Pro simulator with iOS 27, a development native binary and current Metro code. The runtime account was the development QA account. Screenshots are under `screenshots/`.

Verified Home, Practice and Analytics rendering; paywall headline, benefits, annual default and existing localized prices; Continue free returning to Analytics; saved coaching reports remaining readable; sign-out returning to sign-in; signing back into the same account restoring its server history; and an unauthenticated `/feedback` deep link remaining at sign-in.

The simulator used mocked practice. Earlier development checks exercised providers with synthetic audio and RevenueCat Test Store purchases. **Neither is a substitute for a physical microphone session or Apple sandbox purchases from the release binary.** HMR/dev-client setup errors observed while changing the root layout were resolved before the final sign-out checks; those screenshots are retained as investigation evidence, not claimed as release-build failures.

## Deployed state

- Convex development: `adorable-rat-131`; production: `enduring-kangaroo-904`. Both have the security backend changes.
- Production `ALLOW_APP_STORE_SANDBOX=true` supports public TestFlight. Only verified Apple App Store sandbox subscriptions use this exception. Test Store cannot grant production cloud access.
- RevenueCat production webhook: Production and Sandbox, original authenticated destination retained.
- EAS Hosting: `https://clarityapp.expo.app`, deployment `k46cqay8hf`, exported with production variables and deployed with local dotenv loading disabled. Includes hardened forwarding adapters and updated privacy text.
- Old public provider hostname returns 404 for all three legacy routes. Eighteen retired versions returned 401/404/502 without generated output. The old AI Gateway credential was already revoked; never restore it.
- Native/security fixes, dependency patch and release checks are **local changes awaiting a new native build**. No commit, push, OTA publication, App Review submission or TestFlight build was performed by this review. Preserve concurrent UI edits from the other task.

## Required before opening public TestFlight

1. **Confirm Azure Key 1 was regenerated.** It was previously bundled publicly. Backends use Key 2 now; switching keys does not revoke Key 1. Revocation remains unverified. Regenerate only Key 1 on `speech-app-expo`. The user was asked for its current status; no confirmation was received during this review.
2. **Make the three Apple subscriptions the same level.** The last App Store Connect inspection showed yearly at level 1, monthly/weekly at level 2, all Prepare for Submission. Put all three at level 1 and complete any product metadata needed for sandbox availability. Existing prices must stay unchanged. This is a subscription behavior/configuration issue, not a server entitlement bypass.
3. **Build and install a new production TestFlight binary.** Expo native patch versions changed, so do not rely on an old binary or just an OTA update. Run type checks and tests on the final combined workspace, then use the validated release workflow with `force_native=true`.
4. **Run actual Apple sandbox acceptance on that binary:** all three plans load at the existing prices; each grants the same Pro access; cancel preserves the current screen; purchase and restore resume the requested feature once; restore after reinstall works; pending payment does not unlock; expiry removes new paid processing while saved reports remain readable. Exercise Apple/Google login, sign-out and account switching on the release auth configuration.
5. **Run physical audio/offline checks:** basic free practice with no entitlement and after preview exhaustion, a 90-second preview, upgrade from a retained real recording, microphone denial/interruption, silence/restart, interrupted network processing, offline basic practice and previously saved feedback. Confirm one session and one practice-time contribution after upgrading a recording.

## Before monetized App Store launch

- Disable the production Apple-sandbox exception and verify production receipts separately.
- Populate actual Azure assessment/prosody rates and earned net revenue share. Set up delivery for cost alerts; currently they are visible only in Convex logs and `costAlerts`. Public TestFlight transactions generate no earned revenue but provider usage still costs money.
- Complete the remaining accelerated subscription lifecycle checks (renewal, grace period, refund, transfer), store privacy declarations and any required review metadata.
- Keep tracking the remaining dependency advisories and React Doctor findings; this report does not waive them or certify a vulnerability-free app.
