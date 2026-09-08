/**
 * Per-icon deep imports for the free Hugeicons set.
 *
 * `@hugeicons/core-free-icons` maps the `./*` export subpath at
 * `./dist/types/*.d.ts`, but ships only four declaration files (the index and
 * the three loaders) against 12,061 icon modules — so every deep import
 * resolves to an untyped module and `strict` turns that into TS7016. The pro
 * packages this project migrated off did ship a `.d.ts` per icon, which is why
 * the marketing page could deep-import them.
 *
 * The deep import is deliberate: the marketing bundle pulls in eight icons
 * rather than the whole index (see AGENTS.md). This declares the shape those
 * modules actually have — a default-exported icon array — so the web-only
 * screen keeps both its types and its bundle size.
 */
declare module '@hugeicons/core-free-icons/*' {
  import type { IconSvgElement } from '@hugeicons/react-native';

  const icon: IconSvgElement;
  export default icon;
}
