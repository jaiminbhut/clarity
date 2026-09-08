# Fork handover checklist

Re-homing this fork onto your own license footing, accounts, identifiers and
domain. Derived from an audit of the repository at commit `9b35eb9`.

Order matters. The license question settles first, the things you cannot
relicense come out next, and identifiers get swapped only once the accounts they
point at exist.

**Legend** — `[!]` blocks a public deploy · `[R]` required before release ·
`[?]` judgement call or verification

Not legal advice. The font question in particular is worth a real opinion before
going commercial.

---

## Blockers before a public deploy

1. ~~The four `SF-Pro-Rounded-*.woff2` files under `assets/fonts/marketing/`.~~
   **Resolved 2026-09-08** — replaced with OFL Google Sans Flex Rounded.
2. ~~`PRIVACY_URL` in `app/paywall.tsx:36` pointing at `clarityspeech.app`.~~
   **Resolved 2026-09-08** — now `https://devtownhall.com/speakwell/privacy`.

Both blockers are cleared. The policy itself still has to exist at that URL
before release (Phase 6).

---

## Phase 1 — Establish the right to use it

Everything downstream assumes you have a grant. **Settled — you do.** What
remains here is notice hygiene, not permission.

- [x] `[?]` **License grant — verified as a public MIT release.**
      Checked 2026-09-08. The upstream repo is
      [github.com/SchroederNathan/clarity](https://github.com/SchroederNathan/clarity):
      **public**, 318 stars, described as "A speech companion app built with
      Expo", classified by GitHub as **MIT License**, and its `README.md` states
      MIT. Publishing a repo publicly under MIT is a grant to anyone who obtains
      a copy — you have one. This is not an inference from the fork; it is the
      author's own public release.

- [ ] `[?]` **Optional: ask for the copyright line to be corrected.**
      `LICENSE` is the unedited Expo template — *"Copyright (c) 2015-present 650
      Industries, Inc. (aka Expo)"* — and upstream has the identical file, so the
      defect is theirs, not something the fork introduced. The MIT **terms** are
      present and the repo is published under them, so this is a defective
      notice, not a missing grant. Low risk, cheap to fix: ask Nathan to put his
      own name on the copyright line. Not a blocker.

- [ ] `[R]` **Keep the license text and attribution.**
      MIT's single obligation: retain the copyright and license notice you
      received in any distribution. Keep `LICENSE` as-is rather than replacing
      it, and add your own copyright for your changes alongside it — optionally
      with a line crediting the original work to Nathan Schroeder, which the
      current file does not do.

## Phase 2 — Remove what MIT cannot cover

A permissive license on the repo does not relicense third-party assets inside
it, or the author's brand.

- [x] `[!]` **Replace the marketing webfonts.** Done 2026-09-08.
      The four `SF-Pro-Rounded-*.woff2` files are deleted. Web now serves Google
      Sans Flex Rounded — the OFL family the app already ships for Android —
      converted from `assets/fonts/android/*.ttf` with fontTools, at 35–38 KB per
      face against the 35–44 KB they replace. `constants/fonts.web.ts` is a new
      platform module mirroring `fonts.android.ts`, and `OFL.txt` ships beside
      the woff2 files. Verified by `expo export --platform web`: the four new
      faces are emitted and no `SF-Pro` or `SFProRounded` string survives
      anywhere in the exported bundle.

- [x] `[?]` **The five bundled SF Pro faces — decided: keep them.** 2026-09-08.
      `assets/fonts/SF-Pro-Rounded-*.otf` stay in the iOS binary. Apple licenses
      SF Pro for app UI on Apple platforms, so shipping them inside an iOS app is
      the defensible case; they are bundled only because Expo Go cannot embed
      fonts at build time. This is a deliberate decision, not an oversight — the
      web copies were the part that was not covered, and those are gone.

- [x] `[?]` **Android fonts — verified clear, no action.**
      `assets/fonts/android/` is Google Sans Flex Rounded under the SIL Open Font
      License, with `OFL.txt` shipped alongside and no Reserved Font Name
      declared in the font metadata, so the renamed static instances are fine.

- [ ] `[R]` **Rebrand — text done 2026-09-08, artwork outstanding.**
      95 replacements across 28 files: app name, slug, scheme, all UI copy,
      marketing and legal pages, store metadata, the wordmark text, and
      `clarity-mark.tsx` → `speakwell-mark.tsx`. Copyright is now
      `2026 Jaimin Bhut` and the support address `jaiminbhut35@gmail.com`.

      **Three identifiers were deliberately NOT renamed**, because they are
      persisted keys and renaming them orphans data rather than rebranding it:
      `improveClarity` (MMKV setting + Convex schema field),
      `services/storage.ts` `id: 'clarity.v1'` (the MMKV instance — a rename
      loses every local store), and `lib/history-schema.ts`
      `EXPORT_KIND = 'clarity.history'` (validated on import, so a rename
      rejects previously exported files). Leave them.

      **Still Nathan's artwork, and this is the part MIT does not cover:**
      - `components/marketing/speakwell-mark.tsx` — renamed, but the SVG is
        still his seven-dot logo geometry, "traced from the source app-icon
        artwork". Replace the shapes.
      - `assets/app.icon`, `app.dev.icon`, `app.preview.icon` (Icon Composer
        bundles), `icon.png`, `splash-icon.png`, the three `android-icon-*.png`,
        `favicon*.png`
      - `assets/marketing/clarity-hero-cutout.png` — a product screenshot
      - `gh-preview.png`

- [ ] `[R]` **Match the RevenueCat entitlement to its new id.**
      `lib/entitlements.ts` now reads `PRO_ENTITLEMENT_ID = 'SpeakWell Pro'`.
      Create the entitlement under exactly that string. A mismatch never raises
      — it just makes every customer read as not subscribed.

## Phase 3 — Provision your own services

None of these transfer with the code. Each is an account you open, with its own
keys and its own bill.

- [ ] `[R]` **Apple Developer Program** — $99/yr. Device builds, Sign in with
      Apple, in-app purchase, TestFlight. Register the new bundle id and create
      the App Store Connect record.

- [ ] `[R]` **Google Play Console** — $25 once. Only if you ship Android. The app
      already declares `com.android.vending.BILLING`.

- [ ] `[R]` **Clerk — development and production instances.**
      Your dev instance `divine-rodent-2011` is already running. Production needs
      a second instance on `clerk.<yourdomain>`, and the Convex integration must
      be activated on *each* instance separately.

- [ ] `[R]` **Convex — deployment env vars per environment.**
      `convex/auth.config.ts` reads `CLERK_FRONTEND_API_URL` from the Convex
      deployment, never from `.env.local`. Set it on both with
      `bunx convex env set` and `--prod`. Pointing prod at the dev URL fails as a
      silent "Not authenticated" on every call, with no other symptom.

- [ ] `[R]` **RevenueCat project and entitlement.**
      Recreate the entitlement under the exact id `Clarity Pro`, or rename it in
      `lib/entitlements.ts:28` — a mismatch never raises, it just makes every
      customer read as not subscribed. Release builds need the real `appl_…` /
      `goog_…` keys; without one, purchases stay disabled.

- [ ] `[R]` **Expo account, EAS project and environments.**
      A new project id, plus `development` / `preview` / `production`
      environments. `eas env:pull` rewrites `.env.local` in full and drops
      anything not mirrored in EAS, so `EXPO_PUBLIC_CONVEX_URL` must live there
      too.

- [ ] `[R]` **Google OAuth clients — one per bundle variant.**
      One Web client (also entered in Clerk's Google connection as custom
      credentials) and one iOS client per variant, so the iOS values differ
      between development, preview and production. The URL scheme is the client
      id reversed; a mismatch crashes on tap via an Objective-C exception rather
      than surfacing as an error. All three vars are currently empty in
      `.env.local`.

- [ ] `[R]` **Vercel AI Gateway key** — metered. `AI_GATEWAY_API_KEY`,
      server-side only; powers coaching, generated practice passages and
      pronunciation audio through the API routes. This is the line item that
      scales with users — put a budget alert on it.

- [ ] `[?]` **Azure Speech key and region** — optional. Adds phoneme-level
      pronunciation scoring. Without it the local aligner still produces a
      complete result, so you can ship and add it later.

## Phase 4 — Replace the embedded identifiers

Mechanical, but do it after phase 3 — most of these values are handed to you by
the accounts you just opened.

- [x] `[!]` **Point the paywall's privacy link at your domain.** Done
      2026-09-08 — `https://devtownhall.com/speakwell/privacy`. The Apple
      standard EULA link beside it is kept. `web/support.tsx` and the three
      `store.config.json` URLs (marketing, support, privacy, plus the copy of
      the privacy URL inside the App Store description) now point at the same
      domain.

- [x] `[R]` **Bundle identifier and package name.** Done 2026-09-08 —
      `com.devtownhall.speakwell`, in `app.config.ts` and `app.json` for both
      platforms; the `.dev` and `.preview` variants derive from it. The stale
      comment about `com.schroedernathan.clarity` being unregistrable on Nathan's
      Apple team is gone with it. `ios/` and `android/` are gitignored, so the
      native projects pick this up on the next prebuild — the currently
      installed simulator app keeps the OLD id and should be deleted.

- [ ] `[R]` **Expo owner, project id and router origin.**
      In `app.json`: `owner: "exponathan"`, `extra.eas.projectId`, and
      `extra.router.origin` pointing at `exponathan-clarity.expo.app`. The
      Updates URL is derived from the project id — a stale one silently sends
      release builds to a retired project.

- [ ] `[R]` **App Store Connect app id.**
      `eas.json` submits to `ascAppId: "6800457983"` — their App Store record.
      Replace it before any `eas submit`.

- [ ] `[R]` **Store metadata and copyright.**
      `store.config.json` carries `"copyright": "2026 Nathan Schroeder"` plus the
      title, subtitle and keyword set that get pushed straight to App Store
      Connect.

- [ ] `[R]` **Site, TestFlight link and support contact.**
      Their website, beta invite `testflight.apple.com/join/CMRNm4w4` and support
      details are spread across `constants/marketing.ts`, `web/privacy.tsx`,
      `web/support.tsx` and `README.md`.

- [ ] `[?]` **Stale references in comments and agent docs.**
      `convex/auth.config.ts` and `.env.example` name `clerk.clarityspeech.app`
      as the production URL; `.codex/MEMORY.md` and `.agents/` describe their
      pipeline. Wrong comments cost real debugging time later.

- [ ] `[?]` **Final sweep.** One grep catches leftovers:

      ```bash
      grep -rn "schroedernathan\|exponathan\|clarityspeech\|6800457983\|CMRNm4w4\|c062263d" \
        --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=ios .
      ```

## Phase 5 — Repo hygiene you inherited

Not license problems — just things that are broken or aimed at infrastructure
you don't own.

- [x] `[R]` **Settle the package manager and restore a lockfile.** Done
      2026-09-08. Bun, matching the README, CI and `.codex/MEMORY.md`. `bun.lock`
      is regenerated (283 KB, 889 packages) and the stale
      `packageManager: yarn@1.22.22` field is removed from `package.json` — it
      named a package manager the project never used and would have put a
      corepack yarn shim in front of a bun-only lockfile. Verified: the exact CI
      command `bun install --frozen-lockfile` now succeeds, no version drift in
      expo / react-native / react / expo-router / convex / @clerk/expo /
      reanimated, and typecheck still passes.

- [ ] `[?]` **Review the inherited CI and agent automation.**
      The workflows expect a `preview-approved` label, a `pr-preview` EAS
      environment and repository secrets that only exist on their account, plus a
      TestFlight feedback → triage → fix-agent pipeline. Either rebuild them on
      your infrastructure or delete them; half-wired automation is worse than
      none.

## Phase 6 — Obligations that come with shipping

Review requirements the app already satisfies in code, but which are now yours to
keep true.

- [ ] `[R]` **Publish your own privacy policy and support page.**
      `web/privacy.tsx` and `web/support.tsx` already exist as routes — rewrite
      the content for your entity and host them on your domain. Both stores
      require a reachable privacy URL.

- [ ] `[R]` **Declare what leaves the device.**
      Recorded audio goes to Azure Speech for scoring and session measurements go
      to the AI Gateway for coaching. Both need declaring in App Privacy and Play
      Data Safety. The onboarding screen already tells users the recording is sent
      to a speech service — keep that promise accurate.

- [ ] `[R]` **Permission strings describe your app.**
      The microphone, speech recognition and photo-library usage descriptions in
      `app.json` use `$(PRODUCT_NAME)`, so they follow your rename — but re-read
      them against what your build actually does.

- [ ] `[R]` **Keep in-app account deletion working.**
      App Store guideline 5.1.1(v). Already implemented in `services/account.ts`
      and `convex/account.ts`, with the ordering that matters — server rows
      first, then the Clerk user. Test it end to end on your own backend before
      submitting.

- [ ] `[R]` **Create your subscription products and offering.**
      Products in App Store Connect and Play, wired to a RevenueCat offering the
      paywall can fetch. Until then, dev builds fall back to RevenueCat's Test
      Store so the paywall still renders on a simulator.
