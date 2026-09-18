# decode-uri-component 0.2.2

The patch backports the linear decoder from upstream 0.5.0 to the CommonJS
version required by Expo Router's query-string 7 dependency. A direct override
to 0.5.0 changes the module to ESM and breaks that caller's API. The patch also
preserves 0.2.2's plus-to-space behavior.

Source: https://github.com/SamVerschueren/decode-uri-component/releases/tag/v0.5.0
Advisory: https://github.com/advisories/GHSA-vcc3-ghjq-m6fr

`bun install --frozen-lockfile` applies this automatically. The security suite
exercises the actual query-string dependency with malformed input. The registry
audit still reports the original version number; remove this patch once Expo's
dependency chain moves to a compatible fixed release.
