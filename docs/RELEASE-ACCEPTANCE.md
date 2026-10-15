# Release acceptance and manual Pi handoff

This branch implements the approved spec and mockups. Local checks do not establish acceptance on the Raspberry Pi or through Cloudflare. The owner selected manual Pi verification, and no live deployment, tunnel/Caddy change, GitHub push or merge has been performed.

## Local coverage

| Spec | Evidence |
| --- | --- |
| 1–2: scope and exclusions | Self-hosted Next.js application; no member accounts, payment processing or email dependency |
| 3: shared roles | Authentication/session/CSRF integration tests and login browser tests |
| 4: seasons | Window/DST/publication/copy/deletion integration tests and season management browser tests |
| 5: shirt styles | Stable color identities, size/price validation, historical snapshots; catalog integration and browser tests |
| 6: paired artwork sets and blanks | PNG/image validation, asset persistence, front/back associations; asset and catalog tests |
| 7: placement | Normalized position/scale/rotation, preview composition and explicit save; placement API/browser tests |
| 8: ordering and lookup | Idempotent checkout, optimistic edits, server prices, quantity, single-set default; order API/member browser tests |
| 9: admin corrections | Versioned edits, cancellation/restoration and Open / Delivered · unpaid / Complete statuses; admin integration/browser tests |
| 10: CSVs | Billing, member delivery and manufacturer variants; cancellation excluded; no status or season columns; season filenames; export tests |
| 11: responsive views | Desktop, 390px and 320px ordering/lookup, matching field typography/heights and readable size selection; browser assertions and visual inspection |
| 12: integrity | SQLite constraints/transactions, stale-update conflicts, frozen line snapshots, stable asset identities; integration tests |
| 13: hosting | Actual Linux ARM64 images, non-root read-only runtime, loopback port, SQLite/Sharp, upload/restart persistence; Docker smoke tests |
| 14: prototype boundaries | Real persistence/auth/server validation; supplied official logo remains an owner input |
| 15: acceptance | Local suites and container rehearsals below; actual Pi/domain checklist remains pending |

Backup rehearsals cover verified SQLite/assets pairing (including retained WAL), truncation, missing assets, unsafe paths, schema mismatch, denied restoration writes, refusal to overwrite without an explicit flag, retained pre-restore backup and old data, cold installation, actual migration failure with the app left stopped, and explicit recovery after real schema changes with incomplete/completed migration records. The stopped app container is removed before a restore swaps directory paths, preventing a retained Docker bind mount from serving previous data.

## Verified local run

On 2026-10-14, Node 24.11.1 checks passed: strict typecheck, ESLint, production Next.js build, **167 backend/integration tests in 25 files** after the review fix (both actual ARM64 container suites enabled), and **50 browser tests** with 20 intentional viewport-specific skips. Desktop/390px/320px shop and lookup screenshots were inspected. The post-review full suite passed with both actual ARM64 container suites enabled. Types and lint also passed after the fix; browser/UI source was unchanged by that operational fix. The final independent review is recorded in [FINAL-REVIEW.md](FINAL-REVIEW.md); its recovery fix adds explicit quarantine recovery and regressions for partially applied and completed migrations.

## Manual Pi gate

Use the exact disposable rehearsal commands in [OPERATIONS.md](OPERATIONS.md), under **Manual Pi preparation and acceptance**. They require Docker/Compose, Python 3 and the pinned Node 24 toolchain, the matching verified ARM64 image pair and manifest, and a free loopback port 3000. They use isolated generated test data and a distinct Compose project. Do not stop another service to free the port without reviewing it.

After the disposable checks pass, follow [DEPLOYMENT.md](DEPLOYMENT.md) and [BACKUP-RESTORE.md](BACKUP-RESTORE.md). Preserve the existing Pi OS Caddy/tunnel configuration and inspect its paths and trusted-header behavior before making changes. Configure private shared credentials, copy backups off the microSD card, supply the official logo, set up the first real season and obtain live-deployment authorization. Then run the HTTPS domain acceptance checklist in OPERATIONS.md using desktop and mobile clients.

No Pi SSH destination or existing Caddy/tunnel paths were supplied. This document does not assert those environment-specific checks passed.

## Pi verification follow-up — 2026-10-15

The first Pi run passed cold installation but failed both recovery tests at their final host-side inspection of retained UID-10001 data. Linux correctly denied that operator read; Docker Desktop had masked the test assumption. The test now inspects retained databases with a confined read-only maintenance container and checks current database size inside the app container. Storage permissions and production scripts/images are unchanged.

A permanent regression creates UID-10001 mode-700 data inside Linux, proves a UID-1000 read fails, and verifies the confined inspection succeeds. Local verification passed all 4 container checks against the existing `872cf8bd454a` release, 164 backend tests (4 optional Docker checks skipped in that separate run), strict types and lint. The corrected suite must still be rerun on the actual Pi; its result is not asserted here.
