/**
 * Runs on the Convex backend, not in the app bundle. CLERK_FRONTEND_API_URL is
 * therefore set per deployment with `bunx convex env set`, never in .env.local:
 * Metro never sees this file, and Convex never sees .env.local.
 *
 * The value differs per deployment because each Clerk instance has its own
 * Frontend API: the dev deployment points at the `*.clerk.accounts.dev` URL,
 * prod at the production instance's own domain (a SUBdomain — Clerk cannot be
 * hosted on a path). Pointing prod at the dev URL fails as a silent
 * `Not authenticated` on every call, with no other symptom.
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_FRONTEND_API_URL,
      applicationID: 'convex',
    },
  ],
};
