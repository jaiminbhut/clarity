/** Build-time guard: a production artifact must never inherit local QA flags
 * or demo credentials through Expo's automatic .env loading. */
/** @param {Record<string, string | undefined>} env */
function assertProductionEnvironment(env) {
  if (env.APP_VARIANT !== 'production') return;
  const forbidden = [
    'EXPO_PUBLIC_AUTOMATION', 'EXPO_PUBLIC_MOCK_PRACTICE', 'EXPO_PUBLIC_SEED_HOOKS',
    'EXPO_PUBLIC_PREVIEW_ONBOARDING', 'EXPO_PUBLIC_OBSERVE_IN_DEV',
  ].filter(key => env[key] === '1');
  const secrets = Object.keys(env).filter(key => key.startsWith('EXPO_PUBLIC_') && env[key] &&
    /(?:PASSWORD|SECRET|AZURE_SPEECH_KEY|AI_GATEWAY_API_KEY|DEV_SIGNIN_EMAIL)/.test(key));
  if (forbidden.length || secrets.length) throw new Error(`Unsafe production environment: ${[...forbidden, ...secrets].join(', ')}`);
  if (!env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith('pk_live_')) throw new Error('Production requires a live Clerk publishable key');
  if (!env.EXPO_PUBLIC_RC_IOS_API_KEY?.startsWith('appl_')) throw new Error('Production requires a RevenueCat App Store key');
  if (env.EXPO_PUBLIC_CONVEX_URL !== 'https://enduring-kangaroo-904.convex.cloud') throw new Error('Production must use the production Convex deployment');
  if (env.EXPO_PUBLIC_CONVEX_SITE_URL && env.EXPO_PUBLIC_CONVEX_SITE_URL !== 'https://enduring-kangaroo-904.convex.site') throw new Error('Production HTTP must use the production Convex deployment');
}
module.exports = { assertProductionEnvironment };
