# Clarity Pro implementation status

Updated September 9, 2026 UTC. Backend and protected web adapters deployed; updated native client not publicly released by this task. The later security review in `../security-review/report.md` is the current release-readiness assessment.

## Implemented

- One unlimited Pro entitlement across annual, monthly, and weekly products; existing prices unchanged. No paid monthly or daily consumption quota.
- Free basic practice, passages, recording, playback, native speaking measurements, history, effort totals, and Week analytics. Month/All-time score comparisons use the custom paywall.
- One welcome preview plus two UTC-calendar-month previews, each with 90 seconds of assessment, one coaching report, one generated exercise, and five pronunciation clips. Atomic account reservations, successful-output commits, failed-request retries, and immediate release of abandoned unused previews.
- Custom paywall headline and four benefits, annual default, localized RevenueCat prices, visible Continue free, purchase and restore verification, and an account-bound action that resumes once.
- Results upgrade can assess the recording held by the session. Missing recordings offer another practice. Saved feedback is available from Analytics after expiry, including saved pronunciation detail. No cloud recording archive or automatic reconstruction of old reports.
- Provider calls run in authenticated Convex HTTP actions. Expo API routes forward authenticated requests. Provider keys are absent from client code. WAV format/duration checks, locale restrictions, bounded inputs/output, operation deduplication, cached model audio, three concurrent audio chunks, and account assessment queuing are in place.
- Supplemental assessments update the original session and word contributions without adding practice time. A durable undo record protects multi-key local history replacement from interrupted writes. ConvexSync feeds local stores; account deletion includes the new account-owned records.
- Provider usage and estimated costs are stored separately from analytics events. A scheduled seven-day cost review records/logs an alert above 50% of earned net subscription revenue; it does not restrict Pro access.

## Saved service configuration

| Service | Verified state |
| --- | --- |
| RevenueCat entitlement | `Clarity Pro` includes `clarity_pro_yearly`, `clarity_pro_monthly`, `clarity_pro_weekly` |
| RevenueCat development webhook | `Clarity Convex — Development`, Sandbox, authenticated, test delivery HTTP 200 |
| RevenueCat production webhook | `Clarity Convex — Production`, Production and Sandbox, authenticated; Apple sandbox is explicitly enabled for TestFlight; Test Store remains blocked |
| Convex development | `adorable-rat-131`, latest backend deployed |
| Convex production | `enduring-kangaroo-904`, latest backend deployed with type checking |
| EAS Hosting | Protected adapters deployed to `https://clarityapp.expo.app`, latest deployment recorded in `../security-review/report.md`; eighteen unsafe versions retired; two identifiers replaced with protected adapters. |
| AI Gateway | Created and validated a replacement `Clarity Convex` key using the authenticated Vercel CLI, updated both backends, and revoked the dedicated old `Speech App` key. Provider variables were removed from EAS. |
| Azure | Both backends and ignored local server configuration now use Key 2. A fresh assessment with Key 2 returned Success. Previously bundled Key 1 still needs regeneration. |

- [Development webhook](https://app.revenuecat.com/projects/5b920ed3/integrations/webhooks/whintgr90733857ab)
- [Production webhook](https://app.revenuecat.com/projects/5b920ed3/integrations/webhooks/whintgr6361df556c)
- [Production backend](https://dashboard.convex.dev/t/nathan-schroeder/clarity/enduring-kangaroo-904)

## Validation performed

- App and Convex type checks passed.
- Existing test suites: 627 checks passed. Focused premium tests: 70 checks passed. Security regressions: 59 checks passed. Total: 756.
- Tests cover UTC reset, concurrent preview reservations, failed retries, abandoned reservations, account ownership/deletion, identical access for all three products beyond 120 minutes, account job queuing, saved response reuse, expired/grace subscriptions, Test Store isolation, stale reconciliation, transfers, duplicate webhooks, refunds and delayed renewals, and supplemental history replacement/recovery.
- Live authenticated calls from the iOS development app succeeded for Azure pronunciation, AI coaching, exercise generation, and model pronunciation audio. Replaying model audio returned the cached result.
- Live production calls without authentication returned `401 authentication_required` for all four provider routes, preview reservation, and status. Production had zero subscription rows after the Test Store checks.
- Simulator: free Month tap opened the custom paywall; cancelling the purchase kept the screen intact; a valid RevenueCat Test Store annual purchase was verified by Convex and resumed Month analytics; Restore purchase verified access and dismissed the paywall. Continue free returned to practice. These were development Test Store transactions, not Apple StoreKit/TestFlight transactions.
- Production web adapters reject unauthenticated requests. The web export was checked for local credential values; none were present.
- Removed obsolete `EXPO_PUBLIC_AZURE_SPEECH_KEY`, `EXPO_PUBLIC_AZURE_SPEECH_REGION`, and `AI_GATEWAY_API_KEY` from all three EAS environments. Updated the old hostname in app configuration and README.
- `git diff --check` passed.

## Remaining release work

**Legacy provider access disabled.** Expo confirmed deletion of the eighteen unsafe versions. Two identifiers were recreated with protected adapters. Some retired addresses still serve old route handlers, so the dedicated AI Gateway credential was also rotated and revoked. The security-review recheck on September 9 found the old public hostname returned 404 on all three provider routes. The eighteen retired versions returned 401, 404, or 502 without generated output. The current authenticated backend successfully generated an exercise with the replacement key. See `retired-deployments.json`. Expo could not reassociate the legacy subdomain because it reported the name as taken; the current `clarityapp` domain was preserved. Never restore the revoked gateway credential to recover a retired deployment.

1. **Regenerate Azure Key 1.** The backend is already using Key 2. The Azure tab in Dia is on speech-app-expo → Keys and Endpoint. Use Regenerate Key1 and complete Azure's confirmation. Computer-use policy requires the account owner to perform credential changes. Do not regenerate Key 2, which is now serving requests.
2. **Apple subscription levels.** Annual remains level 1; monthly and weekly remain level 2. Apple's browser drag control repeatedly returned the item to its original position. No level change was saved. Put all three in level 1 before launch. [Subscription group](https://appstoreconnect.apple.com/apps/6800457983/distribution/subscription-groups/22323737).
3. **Billing inputs and alert delivery.** Populate `AZURE_ASSESSMENT_USD_PER_HOUR` from the actual Azure agreement, including the prosody add-on, and `REVENUE_NET_SHARE` from actual net receipts after store/RevenueCat fees and applicable taxes. AI/TTS defaults are estimates and must be reconciled against actual invoices. Alerts currently appear in Convex logs and `costAlerts`; external alert delivery is not configured. Failed provider requests may still incur charges that the available response does not expose. Internal SDK retries are not individually metered.
4. **Real device / TestFlight acceptance.** Perform all three Apple sandbox purchases, restore after reinstall, pending payment, renewal, grace, refund, transfer, account switching, offline basic practice, and interrupted recording/processing tests. Verify the 90-second preview and upgrading a real microphone recording end to end. Simulator provider checks used synthetic audio. Production now explicitly accepts verified Apple App Store sandbox receipts for TestFlight (`ALLOW_APP_STORE_SANDBOX=true`); Test Store receipts remain blocked, and sandbox transactions never count as earned revenue. Disable the beta exception before the paid App Store release.
5. **Native client release.** Publish the updated native client against the production Convex URL after the preceding checks. The web forwarding adapters are deployed, and obsolete public Azure variables have been removed from EAS. No native client build, App Review submission, or native public release was performed by this task.

## Contribution model

Use USD consistently. Estimated contribution for a period is earned net subscription revenue minus provider costs for both Free and Pro accounts, minus hosting/storage/other variable costs. Annual receipts are earned across their service period rather than counted entirely on purchase day.

For a preview: `assessment hours × actual Azure hourly rate + coach input/output token cost + exercise input/output token cost + uncached model characters × actual TTS rate`. Ongoing Pro usage has the same per-unit cost and no consumption ceiling. The 50% alert is a review trigger, not a margin guarantee. Missing rates are surfaced as unpriced operations; do not treat them as zero actual cost.

Microsoft documents that pronunciation assessment uses the speech-to-text baseline and that prosody adds cost: [pronunciation assessment billing](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/pronunciation-assessment-tool), [Azure pricing](https://azure.microsoft.com/en-us/pricing/details/speech/).

## Artifacts

- `paywall.png`: custom paywall with localized Test Store prices.
- `scripts/test-pro.ts`: focused entitlement, processing, webhook, and history checks.

Concurrent onboarding and EAS workflow edits in this workspace belong to separate work and were not reverted. This task deployed only the existing marketing web root and its API adapters, not the native onboarding flow.
