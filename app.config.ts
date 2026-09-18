import { ConfigContext, ExpoConfig } from 'expo/config';
import { withEntitlementsPlist, type ConfigPlugin } from 'expo/config-plugins';

import { assertProductionEnvironment } from './lib/release-config';

/**
 * LOCAL ONLY. A free Apple "Personal Team" cannot sign an app that carries the
 * Sign in with Apple entitlement, and both `@clerk/expo` and
 * `expo-apple-authentication` add it unconditionally. With
 * IOS_PERSONAL_TEAM=1 in .env.local the entitlement is stripped so the dev build
 * installs on a device; the Apple button then fails, and the debug-only
 * "Sign in as dev" button (EXPO_PUBLIC_DEV_SIGNIN_*) is the way in. Never set
 * this in an EAS environment.
 */
const withoutAppleSignIn: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['com.apple.developer.applesignin'];
    return mod;
  });

// app.json stays the base layer. This file overrides only what varies per app
// variant, so `development`, `preview`, and `production` builds install side by
// side. The variant comes from APP_VARIANT, stored in the EAS environments and
// pulled locally into .env.local by `eas env:pull`.
const BUNDLE_ID = 'com.devtownhall.speakwell';

function getBundleId() {
  switch (process.env.APP_VARIANT) {
    case 'production':
      return BUNDLE_ID;
    case 'preview':
      return `${BUNDLE_ID}.preview`;
    default:
      return `${BUNDLE_ID}.dev`;
  }
}

function getName(base: string) {
  switch (process.env.APP_VARIANT) {
    case 'production':
      return base;
    case 'preview':
      return `${base} (Preview)`;
    default:
      return `${base} (Dev)`;
  }
}

function getScheme(base: string) {
  switch (process.env.APP_VARIANT) {
    case 'production':
      return base;
    case 'preview':
      return `${base}.preview`;
    default:
      return `${base}.dev`;
  }
}

// Icon Composer bundles, not flat images. Production returns undefined so the
// app.json icon flows through untouched.
function getIosIcon() {
  switch (process.env.APP_VARIANT) {
    case 'production':
      return undefined;
    case 'preview':
      return './assets/app.preview.icon';
    default:
      return './assets/app.dev.icon';
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  assertProductionEnvironment(process.env);
  const iosIcon = getIosIcon();
  const baseScheme = typeof config.scheme === 'string' ? config.scheme : 'speakwell';
  const easProjectId = (config.extra?.eas as { projectId?: unknown } | undefined)?.projectId;
  const updatesUrl =
    typeof easProjectId === 'string' ? `https://u.expo.dev/${easProjectId}` : config.updates?.url;
  const marketingWeb = process.env.EXPO_MARKETING_WEB === '1';
  const automationBuild = process.env.EXPO_PUBLIC_AUTOMATION === '1';
  const plugins = (config.plugins ?? []).map((plugin) => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name === 'expo-router' && marketingWeb
      ? (['expo-router', { root: 'web' }] as [string, { root: string }])
      : plugin;
  });

  const personalTeam =
    process.env.IOS_PERSONAL_TEAM === '1' && process.env.APP_VARIANT === 'development';

  const resolved: ExpoConfig = {
    ...config,
    slug: config.slug ?? 'speakwell',
    name: getName(config.name ?? 'SpeakWell'),
    scheme: getScheme(baseScheme),
    runtimeVersion: {
      // Automatic production OTA delivery requires a native compatibility
      // boundary even when the app's marketing version stays the same.
      // Existing preview/development builds retain their appVersion runtime.
      policy: process.env.APP_VARIANT === 'production' ? 'fingerprint' : 'appVersion',
    },
    updates: {
      ...config.updates,
      // The simulator profile is a deterministic QA fixture. Letting it pull
      // the shared preview channel could replace its development Clerk config
      // and speech mocks with an unrelated preview bundle on the next launch.
      enabled: automationBuild ? false : config.updates?.enabled,
      // Keep the Updates scope tied to extra.eas.projectId. This project was
      // renamed/relinked once; a copied URL silently pointed release builds at
      // the retired project while EAS Build targeted the current one.
      url: updatesUrl,
    },
    experiments: {
      ...config.experiments,
      typedRoutes: marketingWeb ? false : config.experiments?.typedRoutes,
    },
    extra: {
      ...config.extra,
      // Clerk's native Google hook reads these from `expoConfig.extra` first and
      // `process.env` second, because EXPO_PUBLIC_ reads inside node_modules are
      // not inlined in production bundles. Mirroring them here is what makes a
      // release build find them. The URL scheme is read by the
      // @clerk/expo-google-signin config plugin at prebuild.
      EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID,
      EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_CLERK_GOOGLE_IOS_CLIENT_ID,
      EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME: process.env.EXPO_PUBLIC_CLERK_GOOGLE_IOS_URL_SCHEME,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: getBundleId(),
      icon: iosIcon ?? config.ios?.icon,
    },
    android: {
      ...config.android,
      package: getBundleId(),
    },
    plugins: [
      ...plugins,
      ['expo-dev-client', { addGeneratedScheme: process.env.APP_VARIANT === 'development' }],
    ],
  };

  // Applied last, after every plugin above has added its entitlement.
  return personalTeam ? withoutAppleSignIn(resolved) : resolved;
};
