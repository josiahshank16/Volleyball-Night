# npm audit: current investigation

Audit collected by the GitHub Actions workflow on November 14, 2026.

```
4 high severity, 0 critical, 0 moderate, 0 low
```

The four flagged dependency-chain entries are:

- `firebase`
- `@firebase/firestore`
- `@firebase/firestore-compat`
- `@grpc/grpc-js`

The high-severity root is the Node.js `@grpc/grpc-js` package.
A [2026 advisory](https://github.com/advisories/GHSA-m9gg-hp2v-232j)
describes an authentication-context vulnerability in certain gRPC server
configurations. The Firestore SDK historically pins an old 1.9.x gRPC
line, and the upstream
[Firebase SDK issue](https://github.com/firebase/firebase-js-sdk/issues/10400)
notes that the browser version uses a different transport and doesn't
load the Node gRPC implementation.

**Impact on this project:** Volleyball Night is deployed as static
browser JavaScript through Firebase Hosting. There is no custom
Node.js gRPC server in the deployed website. This reduces direct
exposure to the reported gRPC flaw, but the dependency alert is real
and remains unresolved in the package tree.

npm proposes `firebase@9.14.0` as a forced semver-major remediation.
Do **not** use `npm audit fix --force` without testing; downgrading the
Firebase SDK would risk breaking current Firestore sync.

Next steps:
1. Watch for an upstream fix releasing a patched gRPC dependency.
2. Re-run the build and audit after planned SDK upgrades.
3. Before any future server/SSR/Cloud Functions usage, revisit this
   finding: a Node backend can have a different risk than this
   browser-only static website.

Our GitHub build workflow reports the audit but does not hide it or
block unrelated UI development. Any new security issues must be
examined independently.
