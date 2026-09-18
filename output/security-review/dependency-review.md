# Dependency review

`bun audit` flags four package names (five advisories). These are not five confirmed exploitable app vulnerabilities.

- **decode-uri-component 0.2.2:** reachable through Expo Router's query-string parser. Patched with the upstream 0.5.0 linear decoder, retaining the CommonJS/plus-handling contract. The real dependency is exercised by the malformed deep-link regression. Registry auditing still flags the original package version. See `patches/README.md`.
- **image-size 1.2.1:** two high-severity infinite-loop advisories for ICNS, JXL and HEIF parsers. Used by Metro to inspect bundled assets; no user image upload or remote image-dimension parser was found in the app/backend. Untrusted images should not be admitted to the build pipeline. The npm registry had no compatible patched 1.x release at review time. https://github.com/advisories/GHSA-w3rx-r6r6-pgpr and https://github.com/advisories/GHSA-5p2g-fcmc-qvqq
- **uuid 7/8:** advisory affects v3/v5/v6 buffer handling. Xcode build tooling uses v4; no affected application call was found. Avoid an unrelated major dependency override before TestFlight. https://github.com/advisories/GHSA-w5hq-g745-h8pq
- **stream-json 1.9.1:** comes through Clerk's optional Solana/Jayson dependency chain. The advisory concerns Pick/Ignore/Filter/Replace on deeply nested input; inspected Jayson imports StreamValues and Verifier, and Clarity offers Apple/Google sign-in, not wallet RPC. No affected application path was found. https://github.com/advisories/GHSA-528h-pc64-c93x

Expo packages were moved to the patch versions recommended by Expo Doctor. Its final result was 21/21 checks passing. This does not establish that every third-party dependency is vulnerability-free.
