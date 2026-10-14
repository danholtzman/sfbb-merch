# Foundation dependencies

The production app lives under `web/`; the root mockup remains separate. Versions below are exact and the full transitive tree is in `web/package-lock.json`. Linux ARM64 dependency installation and container builds use the official Debian Node 24 image, pinned by digest in `web/Dockerfile`, with Node 24.21.0 and npm 11.19.0 (verified inside the built image). Local checks use Node 24.11.1. Reassess patches before a real release.

| Package | Pinned version |
| --- | --- |
| `@prisma/adapter-better-sqlite3` | `7.10.0` |
| `@prisma/client` | `7.10.0` |
| `better-sqlite3` | `13.0.3` |
| `next` | `16.4.0` |
| `react` | `19.2.8` |
| `react-dom` | `19.2.8` |
| `sharp` | `0.35.5` |
| `zod` | `4.6.7` |
| `@playwright/test` | `1.64.1` |
| `@testing-library/jest-dom` | `7.0.1` |
| `@testing-library/react` | `16.3.3` |
| `@types/better-sqlite3` | `9.6.0` |
| `@types/node` | `24.19.2` |
| `@types/react` | `19.3.0` |
| `@types/react-dom` | `19.3.0` |
| `@vitest/coverage-v8` | `4.1.11` |
| `eslint` | `9.39.5` |
| `eslint-config-next` | `16.4.0` |
| `prisma` | `7.10.0` |
| `typescript` | `6.0.3` |
| `vitest` | `4.1.11` |

## Audit exceptions and scope

Reviewed October 14, 2026. MySQL2 in Prisma tooling is overridden to compatible version 3.24.6 to address its reported authentication/compression advisories. This app uses SQLite.

Two upstream dependency issues remain; do not describe the complete development tree as vulnerability-free:

- Prisma 7.10.0 pins deepmerge-ts 7.1.5. [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) reports recursion exhaustion with cyclic input; patched deepmerge-ts is 8.x. Forcing a major transitive replacement or downgrading Prisma would be an unverified compatibility change. Prisma configuration is trusted operator code, not uploaded/user input. Recheck when upgrading Prisma and before deployment.
- Next ESLint tooling uses braces 3.0.3 via fast-glob/micromatch. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) reports exhaustion from deeply nested patterns, with no patched release listed. ESLint consumes repository patterns, not web request values; this tooling is omitted from the web runtime. Recheck before release.

Audit counts include dependent packages, so eight reported high entries do not represent eight distinct advisories. The migration Docker target retains Prisma CLI for private migration jobs; the web runtime prunes development and optional peer tooling. Runtime contents and native module operations are checked in the ARM64 smoke test. The foundation is not yet a deployable merchandise application.
