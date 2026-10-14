# SFBB Merchandise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the desktop and mobile SFBB ordering design with durable storage, paired artwork, admin operations, exact CSV reports, and manual ARM64 deployment to the Raspberry Pi.

**Architecture:** One Next.js App Router application serves the responsive member UI, desktop admin UI, authenticated HTTP endpoints, SQLite database, and protected image files. Prisma models use stable IDs; domain services own transactions and authorization-sensitive rules. Caddy and Cloudflare Tunnel remain on the Pi's OS; a single app container is reachable only through a loopback-published port.

**Tech Stack:** Next.js 16.x, React 19.2.x, TypeScript, Node.js 24 LTS, Prisma ORM 7.x with its `better-sqlite3` adapter, SQLite, Sharp for image validation, Zod for request validation, Vitest for domain/integration tests, Playwright for browser tests, npm with a committed lockfile, Docker Compose. Resolve exact patched versions in Task 1 and keep Prisma packages on the same patch release. Do not upgrade to a different major during this implementation without checking SQLite/native-driver compatibility.

**Spec:** `docs/SFBB-MERCH-SPEC.md`; read it with this plan and the root HTML/CSS/JavaScript mockups. The spec has been updated with the subsequent deployment and artwork-publication decisions.

## Global Constraints

- Host at `sfbb.holtzman.io` on a Raspberry Pi 5, 8 GB RAM, 64-bit OS.
- Caddy and Cloudflare Tunnel already run directly on the Pi's OS.
- Build a `linux/arm64` image on Apple Silicon; manually transfer and deploy it on the Pi.
- Source on GitHub; no GitHub Actions or paid deployment service required.
- SQLite and images persist on the microSD card; backups are manual and cover both.
- Two shared credentials and an application login page; no registration or personal member accounts.
- No payment processing, email collection/delivery, or required paid services.
- One default artwork set is a front/back pair; extra sets are optional.
- Publishing requires front and back PNGs for every set offered by any style; unassigned sets do not block it. Blank photos remain optional.
- Evaluate inclusive opening/closing dates in `America/Los_Angeles`; published windows cannot overlap.
- Member modification requires an open published season and retained Open progress. Admin modifications bypass these two restrictions.
- Display one status: Open, Delivered · unpaid, Complete, or Cancelled.
- All three CSV reports exclude cancelled orders and have no Season or Status column.
- Admin remains desktop-only; ordering and Find my order work on mobile.
- Mobile size, quantity, and Add controls are 46px high, 14px type, 20px line-height.
- The supplied SFBB logo replaces the mockup monogram when available; a missing supplied logo must not stall implementation.
- Preserve mockups as references. Do not migrate sample/demo orders or client credentials into production.

## Review Focus

1. A duplicate checkout request or concurrent edit must not create duplicate orders or silently overwrite a newer edit — Tasks 2, 7, 8.
2. A deleted/reordered color or changed price must not alter historical variants, asset associations, or balances — Tasks 5, 7, 9.
3. Midnight/DST and concurrent publication must not allow overlapping windows or out-of-window orders — Tasks 4, 7.
4. A disguised/oversized image, failed upload, or cache refresh must not cross front/back sets or destroy the previous valid asset — Tasks 6, 10.
5. An ARM64 build, database migration failure, or interrupted manual backup must not expose the app or leave data without a recoverable matching asset set — Tasks 1, 11, 12.

---

## Working approach and task dependencies

This is a plan only. Do not scaffold or implement until the user reviews it and authorizes execution. At execution start, inspect applicable repository instructions and use an isolated branch/worktree as appropriate. Keep this plan and the spec in the checkout used by the implementer.

Create the production application under `web/`, leaving the root mockups intact and runnable on port 8765. A separate application directory avoids serving demo credentials/data as production artifacts. Deployment and operator scripts live at root under `deploy/` and `scripts/`.

Implement in task order. Dependencies are: 1 → 2 → 3; seasons (4) depend on 2/3; catalog (5) and assets (6) depend on 4; orders (7) depend on 4–6; UI (8) and reports/admin (9) depend on 7; placement UI (10) depends on 6 and the shell from 8; deployment (11) depends on all application tasks; restore/release acceptance (12) depends on 11.

After each task, run its checks and create one focused commit. Do not commit uploaded files, SQLite databases, secrets, or generated test results. The tests described below are meaningful acceptance tests; avoid implementation-mirroring tests.

## File and module map

```text
web/
  package.json, package-lock.json, tsconfig.json, next.config.ts
  prisma.config.ts, prisma/schema.prisma, prisma/migrations/
  src/generated/prisma/                 # generated client; regenerated during build
  src/app/layout.tsx, globals.css
  src/app/login/page.tsx
  src/app/(member)/shop/page.tsx
  src/app/admin/page.tsx
  src/app/api/{auth,seasons,styles,artwork-sets,assets,orders,reports,health}/...
  src/domain/{types,errors,schemas,money,clock}.ts
  src/server/{config,db,context,authorization,rate-limit}.ts
  src/features/auth/{service,LoginForm}.tsx/ts
  src/features/seasons/{service,validation,SeasonList,SeasonDialog}.tsx/ts
  src/features/catalog/{service,colors,StyleList,StyleDialog,CreateStyleDialog}.tsx/ts
  src/features/artwork/{assets,service,composite,ArtworkDialog,PlacementEditor}.tsx/ts
  src/features/orders/{service,code,cart,Shop,CartDrawer,CheckoutDialog,
                      LookupDialog,OrderDetailsDialog,AdminOrderDialog}.tsx/ts
  src/features/reports/{billing,delivery,manufacturer,csv,filename}.ts
  src/components/{Modal,Header,Field,Button,StatusControl}.tsx
  tests/{unit,integration,e2e,fixtures}/
  vitest.config.ts, playwright.config.ts
  public/brand/sfbb-placeholder.svg
  Dockerfile, .dockerignore
scripts/{build-release,deploy-release,backup,restore,verify-backup}.sh
scripts/lib/runtime.sh
deploy/compose.yaml, Caddyfile.example, .env.example
docs/{DEPLOYMENT,BACKUP-RESTORE,OPERATIONS}.md
```

File names inside feature folders use `.ts` for services/types and `.tsx` for React components. Route modules adapt HTTP to domain services; they must not contain a second copy of business rules. Images are stored outside the source tree and `public/`.

## Shared interfaces and HTTP conventions

Define the following in Task 2 and keep names consistent across tasks:

- `type Id = string`, `type Side = 'front' | 'back'`, `type Role = 'member' | 'admin'`.
- `type Progress = 'OPEN' | 'DELIVERED_UNPAID' | 'COMPLETE'`.
- `type Lifecycle = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'`.
- `type PlacementValues = { x: number; y: number; width: number; rotation: number }`.
- `type Actor = { role: Role; sessionId: Id }`.
- `type RequestContext = { actor: Actor; now: Date }`; only the server supplies this context.
- `type ServiceResult<T> = Promise<T>`; services throw `AppError` with `code`, HTTP status, message, and optional field errors.
- `type OrderLineInput = { styleId: Id; artworkSetId: Id; colorId: Id; sizeId: Id; quantity: number }`.
- `type AdminOrderLineInput = OrderLineInput & { unitPriceCents: number; originalLineId?: Id }`.
- `type OrderView = { id: Id; code: string; seasonId: Id; fullName: string; note: string; progress: Progress; cancelled: boolean; version: number; lines: OrderLineView[]; amountOwedCents: number }`.
- `type OrderLineView = OrderLineInput & { id: Id; unitPriceCents: number; styleName: string; artworkSetName: string; colorName: string; colorHex: string; sizeLabel: string }`.
- `type StyleView = { id: Id; seasonId: Id; name: string; description: string; unitPriceCents: number; cut: 'classic' | 'fitted' | 'long'; version: number; colors: ColorView[]; sizes: SizeView[]; artworkSetIds: Id[] }`.
- `type ColorView = { id: Id; name: string; hex: string; position: number }`; `type SizeView = { id: Id; label: string; position: number }`.
- `type ArtworkSetView = { id: Id; seasonId: Id; name: string; frontAssetId: Id | null; backAssetId: Id | null; version: number }`.
- `type SeasonView = { id: Id; name: string; opensOn: string; closesOn: string; announcement: string; lifecycle: Lifecycle; version: number }`.
- `type AssetView = { id: Id; mime: 'image/png' | 'image/jpeg'; width: number; height: number; byteSize: number }`.

Authenticated reads use GET; mutations use POST/PATCH/DELETE with same-origin checks and CSRF protection. Successful API responses wrap `{ data }`, errors `{ error: { code, message, fields? } }`. Use 401 unauthenticated, 403 unauthorized, 404 unknown resource, 409 stale version/reference/window conflicts, 422 validation, 429 throttling. Every resource lookup verifies its season associations. Browser-supplied role, date, price, computed total, and session ID are not authoritative.

Do not cache sensitive/order/admin responses or make them public through Next.js rendering caches. API routes that use SQLite or Sharp run in the Node.js runtime, not an Edge runtime.

## Task 1: Establish a reproducible ARM64 application foundation

**Files:** Create `web/package.json`, lockfile, TypeScript/Next/test configs, `web/prisma.config.ts`, `web/src/app/layout.tsx`, `web/src/app/api/health/route.ts`, `web/src/server/config.ts`, `web/src/domain/errors.ts`, `web/Dockerfile`, `.dockerignore`, root `.gitignore`; tests `web/tests/integration/health.test.ts` and `config.test.ts`.

**Interfaces:** Produces `readConfig(env: NodeJS.ProcessEnv): AppConfig`, `AppError`, and `/api/health` returning `{ data: { status: 'ok' } }` without secrets. `AppConfig` contains database URL, data directory, public origin, credential hashes, session-secret value, and session TTL.

- [x] Add `config_rejects_missing_secrets_or_nonabsolute_data_dir` and `health_returns_no_secrets`; initially fail until configuration/handler exist. Test defaults: 12-hour session TTL and public origin `https://sfbb.holtzman.io`; allow explicit localhost origins in development/test only.
- [x] Resolve security-patched releases in the agreed major lines; install with exact saved versions and commit the npm lockfile. Use matching `prisma`, `@prisma/client`, `@prisma/adapter-better-sqlite3` 7.x versions; install `better-sqlite3`, Sharp, Zod, Vitest, Playwright, and React test tooling. Record exact resolved versions in `web/package.json` and the release documentation. Do not choose experimental Prisma 8 SQLite support for this plan.
- [x] Implement lazy runtime configuration so production builds do not require or bake in credentials or the real database; implement the minimal app/health endpoint; add `typecheck`, `lint`, `test`, `test:e2e`, `build`, and `start` npm scripts. Use ESLint directly, not removed framework lint commands.
- [x] Build dependencies in a Debian-based Node 24 Docker stage targeting `linux/arm64`. Never copy the Mac's `node_modules` into the image. Include native SQLite/Sharp dependencies and Prisma CLI/generated code needed by the migration job; use a non-root runtime UID/GID 10001.
- [x] Run `cd web && npm run typecheck && npm run lint && npm test -- tests/integration/config.test.ts tests/integration/health.test.ts && npm run build`; require all checks to pass.
- [x] Build/load a test Linux ARM64 image and verify `process.platform === 'linux'`, `process.arch === 'arm64'`, and loading Sharp/SQLite succeeds inside it. Pin the base-image digest in the final Dockerfile after this check.
- [x] Commit the reproducible application foundation; no production data or real secrets.

**Stage 1 checkpoint (October 14, 2026):** Fresh Mac lockfile install, strict typecheck, lint, 11 configuration/health tests, Next build, and Linux ARM64 non-root SQLite/Sharp/live HTTP smoke checks passed. Dependency audit exceptions are recorded in `docs/DEPENDENCIES.md`. Prisma generation/schema copying is deferred to Task 2, where the schema is introduced. The web runtime omits Prisma CLI and test/lint tooling; a separate migration target retains CLI dependencies. No deployment has occurred.

## Task 2: Create durable schema and transactional infrastructure

**Files:** `web/prisma/schema.prisma`, first migration, `web/src/server/db.ts`, `web/src/domain/{types,schemas,money,clock}.ts`, `web/tests/integration/{schema,transactions}.test.ts`, `web/tests/unit/money.test.ts`, `web/tests/fixtures/database.ts`.

**Interfaces:** Produces the shared types above, `db` Prisma client, `withTransaction<T>(work: (tx: DbTransaction) => Promise<T>): Promise<T>`, `parseUsd(text: string): number`, `formatUsd(cents: number): string`, and `bandDate(now: Date): string` using `America/Los_Angeles`.

- [x] Write tests for cent parsing (`'25.10' → 2510`, reject `'1.001'`, negative and nonfinite inputs), foreign-key rejection, unique order code, version conflict, and full rollback after a failing multi-record mutation. Run `npm test -- tests/unit/money.test.ts tests/integration/schema.test.ts tests/integration/transactions.test.ts`; expect failures before implementation.
- [x] Model spec entities with UUID IDs: seasons; styles; colors/sizes with display positions; artwork sets/style associations; assets; blank photos; placements; orders/order lines; sessions; idempotency records; persistent rate-limit buckets. Use restrictive order reference foreign keys and snapshot fields; cancellation is a flag, never deletion of orders.
- [x] Enforce uniqueness for per-season normalized artwork names, per-style normalized color names and size labels, and placement/blank side+scope combinations. Because SQLite NULL uniqueness does not enforce a single shared-scope row, store a non-null `scopeKey` of `all` or stable color ID and constrain it in the service. Shared placements and blank photos retain optional color FK plus scope key.
- [x] Add `version` to editable parent records and use compare-and-increment writes for stale-edit rejection. Represent progress and lifecycle with validated values/check constraints. Initialize SQLite foreign keys, WAL journal mode, and 5000ms busy timeout; use one application process.
- [x] Implement money/time/error helpers and temporary-database test fixtures; production initialization starts with one empty draft season and one paired set, never mockup orders. Initialize the empty database once with a draft named First season, opening and closing dates both set to the current Los Angeles date, one empty front/back artwork set, and no merchandise. A transaction and initialization marker prevent concurrent/repeated bootstrap; it never publishes a season or inserts sample orders.
- [x] Apply migrations to an empty temporary DB twice: first creates schema, second is a no-op. Re-run Task 2 tests and typecheck; all pass. Commit schema/infrastructure.

**Stage 2 checkpoint (October 14, 2026):** 56 tests pass on Mac and Linux ARM64. Strict typecheck, lint, and Next production build pass. Non-root ARM64 migration, generated-client writes, repeated migration, and persistence across restarts pass using disposable storage. `docs/DATABASE.md` records explicit bootstrap/startup handoff, single-process coordination, custom SQL checks, and stop-before-migrate requirements. No Pi deployment has occurred.

## Task 3: Implement shared-account login and server authorization

**Files:** `web/src/features/auth/{service.ts,LoginForm.tsx}`, `web/src/server/{authorization,context,rate-limit}.ts`, login page, auth login/logout API routes, `web/tests/integration/auth.test.ts`, `web/tests/e2e/login.spec.ts`.

**Interfaces:** `signIn(username: string, password: string, now: Date): Promise<{ token: string; actor: Actor }>`; `getActor(token: string | undefined, now: Date): Promise<Actor | null>`; `requireActor(request: Request, role?: Role): Promise<RequestContext>`; `signOut(token: string): Promise<void>`; `authorizeMutation(request: Request, context: RequestContext): Promise<void>`.

- [x] Write `unauthenticated_admin_api_returns_401`, `member_mutation_returns_403`, `spoofed_role_is_ignored`, `logout_invalidates_cookie`, `cross_origin_mutation_is_rejected`, and `session_expires_after_12_hours`. Browser tests assert the two shared roles land on shop/admin respectively and no registration/demo-credential UI exists.
- [x] Store only credential hashes in private deployment configuration; use Node scrypt for password verification and random opaque session tokens, storing token hashes in SQLite. Session cookie is HttpOnly, Secure in production, SameSite=Lax, path `/`, 12-hour expiry. Use a per-session CSRF token plus same-origin validation for mutations.
- [x] Apply persistent login throttling: five failed attempts per username+trusted client address in 15 minutes, with generic failures. Trust client-address forwarding only from the configured local Caddy/tunnel path; never use an arbitrary posted/header IP to escape throttling.
- [x] Implement the mockup login form and Sign out with matching typography, errors, and Show/Hide password. Mobile administrator sessions show the member experience, but server authorization does not depend on viewport width.
- [x] Run `npm test -- tests/integration/auth.test.ts` and `npm run test:e2e -- login.spec.ts`; expect all tests to pass. Commit auth.

**Stage 3 checkpoint (October 14, 2026):** 77 backend tests pass on Mac/Linux ARM64; 12 desktop/mobile browser checks pass, including disabled storage and non-JavaScript form submission. Strict typecheck, lint, and production build pass. ARM64 production HTTP smoke verifies both roles, Secure cookie flags, admin gating, CSRF/origin rejection, logout revocation, and private rendering. `docs/AUTHENTICATION.md` records private configuration, proxy trust, and later member-state integration. No Pi/Caddy/Cloudflare configuration has been changed.

## Task 4: Implement seasons, readiness validation, and settings modals

**Files:** `web/src/features/seasons/{service.ts,validation.ts,SeasonList.tsx,SeasonDialog.tsx}`, season API collection/detail/publish routes, admin page shell, `web/tests/integration/seasons.test.ts`, `web/tests/e2e/seasons.spec.ts`.

**Interfaces:** `createSeason(ctx, input: CreateSeasonInput): Promise<SeasonView>`; `updateSeason(ctx, id, expectedVersion, input: SeasonSettingsInput): Promise<SeasonView>`; `publishSeason(ctx, id, expectedVersion): Promise<SeasonView>`; `deleteSeason(ctx, id, expectedVersion): Promise<{ selectedSeasonId: Id }>`; `isOrderingOpen(season: SeasonView, now: Date): boolean`. Input fields match spec; `CreateSeasonInput` additionally has nullable `copyFromSeasonId` and boolean `reuseArtwork`.

- [x] Write tests for inclusive dates, exact Los Angeles midnight across DST, overlap at a shared boundary, empty catalog publication, missing front/back PNG, unassigned incomplete set, cancelled-order deletion protection, last-season protection, and concurrent publish attempts. Run targeted tests; initially fail.
- [x] Implement all mutations in transactions and recheck publication/date overlap under the write transaction. Offered sets are those associated with at least one season style; require valid asset records for both sides of every offered set. Blanks are optional. Creating a draft always creates at least one paired-set record.
- [x] Copy catalog definitions/photos into new season records; default to one fresh paired set and no old placements. Explicit reuse copies set definitions/references and placements; never copy orders. Keep shared asset references safe for later deletion.
- [x] Implement Orders/Merchandise/Seasons tabs and selected-season state. Hide banner on Seasons. Settings live only in modal; Save/Cancel/Delete work exactly as specified. Treat empty database initialization separately from last-season deletion protection.
- [x] Run season domain tests and `npm run test:e2e -- seasons.spec.ts`; confirm publication explains all missing sides and no order-reference data is deleted. Commit seasons.

**Stage 4 checkpoint (October 14, 2026):** Season CRUD/copy/publication and modal UI are implemented. 86 backend tests pass on Mac/Linux ARM64; 17 desktop/mobile browser checks pass, with five desktop-admin checks intentionally skipped on mobile. Strict typecheck, lint, and production builds pass. `docs/SEASONS.md` records API contracts, explicit first-admin-render bootstrap, shared-asset safety, and later catalog/member integration. Orders/Merchandise content and preview bags remain their dedicated later stages. No live deployment.

## Task 5: Implement custom styles and safe color/size associations

**Files:** `web/src/features/catalog/{service.ts,colors.ts,StyleList.tsx,StyleDialog.tsx,CreateStyleDialog.tsx}`, style CRUD/color/availability API routes, `web/tests/integration/catalog.test.ts`, `web/tests/e2e/catalog.spec.ts`.

**Interfaces:** `createStyle(ctx, seasonId, input: CreateStyleInput): Promise<StyleView>`; `updateStylePrice(ctx, id, version, cents): Promise<StyleView>`; `setStyleArtworkSets(ctx, id, version, setIds): Promise<StyleView>`; `saveStyleColors(ctx, id, version, colors: Array<{ id?: Id; name: string; hex: string }>): Promise<StyleView>`; `deleteStyle(ctx, id, version): Promise<void>`. Create input includes name, description, price cents, cut, color definitions, ordered size labels, and optional template style ID.

- [x] Write tests for name/size trimming, arbitrary sizes, duplicate case-insensitive colors, zero price, price changes preserving order snapshots, cross-season sets, removal of used colors, last-color/set guards, and deletion of styles used only in cancelled orders.
- [x] Add stable color IDs and explicit display order. Save colors stages addition/edit/removal as one transaction; protect ordered colors and delete only removed unused color assets/placements. No index shifting occurs in production. Before catalog changes, legacy imported lines, if supported at all, receive complete snapshots; no browser-demo import is required.
- [x] Return removed IDs in mutation responses as needed for the client to clear unsent cart lines and reset selected previews. Update current selections to the first remaining valid color/set. Confirm style deletion separately.
- [x] Implement full-width style sections, same-container price/Manage style header, filled collection actions, outlined style actions, and modal controls. Color changes save explicitly; price/set availability save immediately and expose failures. At least one set per style is mandatory.
- [x] Run `npm test -- tests/integration/catalog.test.ts` and `npm run test:e2e -- catalog.spec.ts`; assert historical order names/swatches/prices remain unchanged after a catalog rename/recolor. Commit catalog.

**Stage 5 checkpoint (October 14, 2026):** Custom/template creation, immediate price/set availability saves, staged color editing/removal, and protected style deletion are implemented with full-width previews and modal controls. 95 backend tests pass on Mac/Linux ARM64; 20 browser checks pass, with eight desktop-admin checks skipped on mobile. Strict typecheck, lint, and production builds pass. `docs/CATALOG.md` records stable IDs, snapshot preservation, published readiness, and future cart/asset integration. Uploads/composition remain Stage 6; no live deployment.

## Task 6: Implement durable paired artwork and blank-photo uploads

**Files:** `web/src/features/artwork/{assets.ts,service.ts,ArtworkDialog.tsx,composite.ts}`, asset upload/read routes, set create/delete routes, blank-photo/placement routes, `web/tests/integration/assets.test.ts`, `web/tests/unit/composite.test.ts`, PNG/JPEG test fixtures.

**Interfaces:** `storeImage(ctx, file: File, purpose: 'artwork' | 'blank'): Promise<AssetView>`; `replaceArtworkSide(ctx, setId, version, side: Side, assetId): Promise<ArtworkSetView>`; `setBlankPhoto(ctx, styleId, colorId: Id | null, side, assetId): Promise<void>`; `savePlacement(ctx, styleId, setId, side, colorId: Id | null, values: PlacementValues): Promise<void>`; `getCompositeSpec(styleId, setId, colorId, side): Promise<CompositeSpec>`; `deleteArtworkSet(ctx, setId, version): Promise<{ replacementSetId: Id }>`.

`CompositeSpec` contains blank asset URL or fallback cut/color, artwork asset URL or null, side, and effective placement. It is the sole composition input for member cards/admin previews/editor/bag. `AssetView` URLs are authenticated asset endpoints, never raw filesystem paths.

- [x] Write `front_replace_preserves_back`, `other_style_or_color_is_unchanged`, `fake_png_and_over_8mb_rejected`, `decode_pixel_limit_rejected`, `write_failure_retains_previous_image`, `shared_asset_survives_copy_delete`, and placement-resolution tests. Use an explicit decoded limit of 40 million pixels as an engineering upload safeguard.
- [x] Decode/validate with Sharp; enforce 8 MB compressed limit, correct format, pixel limit, preserved transparency, safe generated filenames, and `/data/assets/` confinement. Stage writes before atomic promotion; update DB references transactionally. Orphan cleanup runs explicitly through an operator command, not synchronous deletion of possibly shared assets.
- [x] Implement set name creation, front/back replacement, and guarded deletion. Both files belong to one set. Offered published sets cannot lose either side; asset replacement is atomic. Protect last set and ordered sets; sole-set styles switch to the named remaining set on confirmed deletion.
- [x] Render both artwork upload slots in Manage artwork, and only unprinted blank uploads in Manage style. Hide selectors/availability lists when only one option exists. No uploads in placement editor.
- [x] Implement normalized 320×310 composition with the spec's 80×136 artwork box, default placement `(50,47.7,25,0)`, ranges, and shared/color override precedence. Do not use the front PNG as missing-back fallback. Production contains no fake band design; an absent asset has a labelled setup state.
- [x] Run asset/composite tests and typecheck. Verify an uploaded PNG remains after app restart. Commit assets/renderer.

**Stage 6 checkpoint (October 14, 2026):** Paired PNG artwork, per-color/side blank PNG/JPEG uploads, protected set deletion, durable validated storage, authenticated image reads, shared SVG composition, and explicit offline orphan cleanup are implemented. 107 backend tests pass on Mac/Linux ARM64; 21 browser checks pass, with nine desktop-admin checks skipped on mobile. Strict typecheck/lint and production builds pass. ARM64 production smoke verifies alpha, invalid-upload rejection, asset/session persistence after container restart, and maintenance packaging. `docs/ARTWORK.md` records contracts and later member/editor/backup integration. No Pi deployment.

## Task 7: Implement authoritative orders, lookup codes, and modification rules

**Files:** `web/src/features/orders/{service.ts,code.ts,cart.ts}`, order create/lookup/member-edit/admin-edit/cancel/restore/progress routes, `web/tests/integration/orders.test.ts`, `web/tests/unit/cart.test.ts`.

**Interfaces:** `submitOrder(ctx, input: SubmitOrderInput, idempotencyKey: string): Promise<OrderView>`; `lookupOrder(ctx, code: string): Promise<OrderView>`; `editMemberOrder(ctx, code, version, input: MemberEditInput): Promise<OrderView>`; `editAdminOrder(ctx, id, version, input: AdminEditInput): Promise<OrderView>`; `cancelOrder(ctx, idOrCode, version): Promise<OrderView>`; `restoreOrder(ctx, idOrCode, version): Promise<OrderView>`; `setOrderProgress(ctx, id, version, progress: Progress): Promise<OrderView>`.

Submit input is `{ seasonId, fullName, note, lines: OrderLineInput[] }`. Member edit adds existing line IDs to preserve historical variants/prices. Admin edit includes `AdminOrderLineInput[]`; snapshots survive when original line/variant remains unchanged. Cart helpers use stable IDs; previews cannot invoke order creation successfully.

- [x] Write tests for same-variant merging, positive integer quantities, integer-cent totals, server-priced new lines, historical color/price preservation, invalid cross-season variants, name/note handling, duplicate submissions, code collision retry, and two simultaneous edits with the same version.
- [x] Define new-order full name as trimmed nonempty ≤100 characters and optional note ≤2000 characters; document these implementation bounds. Generate six uppercase characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` using cryptographic random bytes; enforce global uniqueness with retries. Lookup trims/case-normalizes and rejects wrong length/alphabet.
- [x] Implement submission/window validation/idempotency in one transaction. Bind idempotency keys to session and a normalized request hash: repeated identical requests return the same order; reuse with different payload yields 409. Creation is never allowed from a draft or closed season, irrespective of client preview state.
- [x] Apply member open-window+OPEN checks inside mutation transactions; admins bypass those restrictions but not record/variant/quantity validation. Cancel retains progress and snapshots, restore retains prior progress, Complete/Cancelled amount owed is zero. Progress corrections are allowed in both directions for admins.
- [x] Rate-limit failed code lookup to ten failed attempts per session+trusted address in 15 minutes; use generic not-found responses and private/no-store payloads. Admin name/code search uses admin authorization rather than a public search endpoint.
- [x] Run all order/cart tests, including DST-window transaction tests. Ensure exactly one order survives duplicated checkout and stale edits return 409 without overwriting. Commit orders.

**Stage 7 checkpoint (October 14, 2026):** Authoritative order creation, session-bound normalized idempotency, six-character cryptographic codes, member/admin edits, cancellation/restoration/progress, protected search, and lookup throttling are implemented. 123 backend tests pass on Mac/Linux ARM64; 23 browser/API checks pass across isolated fresh-server passes, with nine desktop-admin checks skipped on mobile. Strict typecheck/lint and production builds pass. `docs/ORDERS.md` records pricing/snapshot/time semantics and Stage 8/9 integration. No Pi deployment.

## Task 8: Recreate member desktop/mobile flows and shared dialogs

**Files:** member shop page, `web/src/features/orders/{Shop.tsx,CartDrawer.tsx,CheckoutDialog.tsx,LookupDialog.tsx,OrderDetailsDialog.tsx}`, `web/src/components/{Modal,Header,Field,Button}.tsx`, `web/src/app/globals.css`, `web/tests/e2e/{member,mobile,dialogs}.spec.ts`.

**Interfaces:** Components consume `StyleView`, `OrderView`, `CompositeSpec`, and Task 7 APIs. `Modal` exposes `{ open, title, onClose, children }`; cart is an explicit reducer with `ADD`, `SET_QUANTITY`, `REMOVE`, `LOAD_ORDER`, `CLEAR`, `REMOVE_UNAVAILABLE` actions. Keep ordinary/test carts in session state, not a public order draft table.

- [x] Write browser tests for login→shop→variant→bag→checkout→confirmation→lookup; single-set addition with no selector; validation errors; copy code; edit/cancel/restore rules; unexpected price/availability refresh; and stale edit errors without losing the user's unsaved inputs.
- [x] Port the mockup visual language into scoped React/CSS components. Keep removed badges/info-strip absent, one Admin link on desktop, matching destructive typography, front/back toggle, and all modal save semantics.
- [x] Implement test-bag mode only for authorized admin preview routes; show explanatory copy and disabled checkout. Switching seasons clears cart/member edit state. Member live shop selects the open published season; closed/scheduled fallback is read-only.
- [x] Implement accessible focus management, Escape, internal scroll, and curtain pointer-start/end handling. Write `drag_inside_to_curtain_keeps_dialog_open` and `curtain_click_closes_dialog` tests, plus keyboard navigation/focus restoration.
- [x] Recreate mobile ≤600px, test at 390×844 and 320×740, with no horizontal overflow. Assert size/input/Add are each 46px with identical top/bottom alignment and 14px/20px type. Admin sessions still render the mobile shop; no mobile iframe in production.
- [x] Run `npm run test:e2e -- member.spec.ts mobile.spec.ts dialogs.spec.ts`; capture visual baselines only after inspecting them against the mockups. No real band member orders are created during testing; use isolated test databases. Commit member UI.

**Stage 3 handoff:** Logout clears `sfbb:cart` and `sfbb:editing-order` and emits `sfbb:signout`. Bind persisted member state to the verified server session ID; inaccessible storage must not prevent sign-out or allow a later session to inherit an old bag.

## Task 9: Finish admin order management and exact CSV exports

**Files:** `web/src/features/orders/AdminOrderDialog.tsx`, admin order table/search/dashboard, `web/src/components/StatusControl.tsx`, all `web/src/features/reports/*.ts`, report routes, `web/tests/integration/reports.test.ts`, `web/tests/e2e/admin-orders.spec.ts`.

**Interfaces:** `billingRows(orders: OrderView[]): string[][]`; `deliveryRows(orders: OrderView[]): string[][]`; `manufacturerRows(orders: OrderView[]): string[][]`; `csvEncode(rows: string[][]): Uint8Array`; `reportFilename(season: SeasonView, report: 'billing' | 'member-delivery' | 'manufacturer-order'): string`. DB selection is selected-season scoped and independent of table search.

- [x] Write report tests for all three exact schemas below, cancelled exclusion, Complete-zero billing, matching variants across Open/delivered/Complete, separate members/order codes, color snapshots, quotes/multiline notes, Unicode slugs, formula prefixes, deterministic order, and empty-header-only reports.
- [x] Implement exact headers:
  - Billing: `Order code,Full name,Quantity,Amount owed,Note`.
  - Member delivery: `Full name,Order code,Item,Artwork set,Color,Size,Quantity,Note`.
  - Manufacturer: `Item,Artwork set,Color,Size,Quantity`.
- [x] Implement UTF-8 BOM/CRLF/quoted cells/formula neutralization. Filenames are `sfbb-{normalized-season-slug}-{opensOn}-{report}.csv`; slug ≤80 characters, fallback `season`. All files omit Season and Status; all exclude cancellations. Member-delivery includes already delivered/Complete orders; manufacturer totals all non-cancelled variants without splitting by progress.
- [x] Implement selected-season dashboard metrics, one combined Status column, cancelled badge, search, View, direct admin item editor, cancellation confirmation, restoration, and immediate progress dropdown updates. Retain code/season/progress on edits. Show version conflicts without silently overwriting.
- [x] Put three exports together with descriptions; admin selection/search changes cannot export another season or filter out unmatched table rows accidentally. Align View/dropdown heights at 40px, prevent arrow wrapping, and use merged Delivered · unpaid label.
- [x] Run `npm test -- tests/integration/reports.test.ts` and `npm run test:e2e -- admin-orders.spec.ts`. Parse browser-downloaded CSVs and assert headers/data against fixture DB. Commit admin reports.

## Task 10: Build the side-aware artwork placement editor

**Files:** `web/src/features/artwork/PlacementEditor.tsx`, placement/composite client helpers, `web/tests/unit/placement.test.ts`, `web/tests/e2e/placement.spec.ts`.

**Interfaces:** Uses Task 6 `CompositeSpec` and `savePlacement`; implements `placementTransform(values: PlacementValues): string` and `nudge(values, key, shift): PlacementValues` in the shared composite module. Editor receives `{ styleId, setId, colorId, side }`, keeping side-aware entry from both image and Edit button.

- [ ] Write exact-value tests for default transform, 0.2/1 point nudges, range clamps, proportional resize, rotation, centering/reset, shared/color override precedence, side separation, and identical viewer/editor coordinate fitting with transparent PNG padding.
- [ ] Implement pointer capture and corner resizing against the actual normalized canvas; do not base percent coordinates on a CSS-scaled image's native dimensions. Keep upload controls absent. Save targets style+set+side+scope only; changing view must not accidentally save the previous side's draft.
- [ ] Open front/back from clickable full-width preview images as well as blue Edit links. Distinguish bold uppercase side labels from actions. Hide the set picker with one option and retain chosen color/set when opening.
- [ ] Use the same renderer in viewer/editor and refresh affected previews after save/upload/color change. First release renders composites as SVG/HTML from authenticated asset URLs; avoid storing generated preview files unless later performance testing requires them.
- [ ] Run `npm test -- tests/unit/placement.test.ts` and `npm run test:e2e -- placement.spec.ts`; inspect front/back PNG fixtures and colored blank photos in screenshots. Commit editor.

## Task 11: Package manual Mac-to-Pi deployment without changing existing services

**Files:** `deploy/compose.yaml`, `deploy/Caddyfile.example`, `deploy/.env.example`, `scripts/{build-release,deploy-release}.sh`, `scripts/lib/runtime.sh`, `docs/DEPLOYMENT.md`; refine Dockerfile; test `web/tests/integration/container-smoke.test.ts`.

**Interfaces:** `scripts/build-release.sh <release-tag>` outputs a `linux/arm64` image archive plus checksum and release manifest. `scripts/deploy-release.sh <archive-path> <release-tag>` runs on the Pi, validates archive/tag/checksum, runs migrations and starts the selected app image. These scripts do not create tunnels, rotate credentials, or automatically edit Caddy.

- [ ] Write a local deployment smoke check: read-only runtime root, writable `/data`, non-root UID 10001, SQLite write/read, Sharp decode, uploaded-file persistence, and health endpoint reachable on the loopback host port. Require container process architecture arm64.
- [ ] Configure Compose app binding `127.0.0.1:3000:3000`; mount `/srv/sfbb-merch/data:/data` and private env from `/srv/sfbb-merch/.env`. Runtime config uses `DATABASE_URL=file:/data/sfbb.sqlite`, `DATA_DIR=/data`, and `PUBLIC_ORIGIN=https://sfbb.holtzman.io`. Uploads are `/data/assets`; ensure directory ownership for UID/GID 10001.
- [ ] Add a one-shot `migrate` Compose service using the matching migration image from the same release/commit to run the migration entry point (`node scripts/migrate.mjs`, which invokes `prisma migrate deploy`); it must not require a public application listener. Keep Prisma CLI/schema/migrations/generated client available in that migration image; web runtime omits CLI/test/lint tooling. Include healthcheck and restart policy; do not rely on multiple Node worker processes against the one SQLite file.
- [ ] Implement Mac build/export with `docker buildx build --platform linux/arm64 --load`, release tag from the Git commit, `docker save` for the matching web and migration images, SHA-256 checksum, and manifest containing commit, both image identities, Node/platform, and schema migration list. Transfer archive, checksum, manifest, and deployment files manually via SSH/SCP. GitHub stores source only; no registry or CI required.
- [ ] Make deployment back up first (Task 12), stop the app, load/verify image, migrate, start, and wait for health. On migration failure leave the app stopped and print recovery instructions; do not auto-start an older image on a possibly changed schema. Retain previous image/archive and matching backup for rollback.
- [ ] Provide an additive Caddy site snippet: `sfbb.holtzman.io { reverse_proxy 127.0.0.1:3000 }`. Inspect the existing site/tunnel configuration before applying it; preserve its routing/TLS choices and validate Caddy config. The tunnel routes to existing Caddy, not a newly exposed Docker port. Document which existing headers/address source the app trusts. Stage 3 requires Caddy to overwrite `X-SFBB-Proxy-Secret` and `X-SFBB-Client-IP` only from validated trusted ingress, with a matching private `TRUSTED_PROXY_SECRET`; otherwise the app ignores forwarding headers and uses its conservative untrusted bucket.
- [ ] Run container smoke locally and on the actual Pi at execution time. Success: image/container checks pass locally. Document the domain checks for Task 12, after backup/restore scripts are complete: HTTPS login/shop/admin/assets work through the domain, unauthenticated admin/export fails, and no app port is publicly bound. Do not invoke deploy-release before Task 12 or deploy until the user authorizes the concrete release.
- [ ] Commit packaging/runbook. Credentials, server address, and SSH destination remain environment/operator inputs, not invented values embedded in scripts.

## Task 12: Deliver manual backup/restore and final acceptance

**Files:** `scripts/{backup,restore,verify-backup}.sh`, `docs/{BACKUP-RESTORE,OPERATIONS}.md`, `web/tests/e2e/release.spec.ts`, plan coverage checklist.

**Interfaces:** `scripts/backup.sh <output-directory>` produces a timestamped archive/checksum/manifest; `scripts/verify-backup.sh <archive>` validates contents/checksum/database integrity; `scripts/restore.sh <archive> <release-tag>` restores while app is stopped and refuses mismatched schema/image unless explicitly handled. Scripts use the actual root deployment Compose file and data directory.

- [ ] Test backup against a disposable container: stop writes, capture SQLite including associated journal files plus all referenced assets, exclude runtime caches, restart after success/failure when safe, verify archive. Do not copy a live DB file without a consistent backup method.
- [ ] Implement manual backup by stopping the app, archiving `/data` and the release manifest into the supplied operator destination, verifying the archive, then restarting. Preserve configuration/secrets separately in an operator-controlled location; document that source on GitHub is not a data backup. No scheduled backup service is introduced.
- [ ] Implement restore into a new/stopped data directory, validate archive paths/checksum/SQLite integrity/referenced assets, set ownership, use the recorded compatible release, then start and smoke-test. Refuse overwrite without an explicit operator flag after a pre-restore backup. Database rollback requires restoring the paired assets and compatible release, not only replacing a container image.
- [ ] Rehearse failure cases: truncated archive, missing artwork file, failed migration, older image/newer schema, denied microSD write, and app restart. Report a clear error and leave the previous verified backup intact.
- [ ] Run final `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, and production `npm run build` on the pinned toolchain. Cover spec sections 1–15 with the task mapping below and review the five Review Focus cases.
- [ ] Perform the release acceptance on the Pi with isolated setup data: shared login, single-set order, paired assets/placement, lookup/member constraints, admin corrections, exact three CSV downloads, restart persistence, and a verified restore. Capture desktop/390px/320px visuals and compare to mockups. Do not use real member data for destructive tests.
- [ ] Document operator steps: configure two credential hashes, supply logo, create first real season, upload both sides, publish, export, update, manually back up, and restore. State which operations are immediate versus explicit-save.
- [ ] Commit final operational documentation and provide the release handoff with validation results and any remaining environment-specific setup. Stop before publishing the live release without deployment authorization.

## Coverage map

| Spec sections | Tasks |
| --- | --- |
| 1–2: purpose, mockups, exclusions | Global constraints; 1, 8, 12 |
| 3: authentication and roles | 3, 8, 11 |
| 4: seasons, windows, copy, preview, deletion | 4, 8 |
| 5: styles, colors, prices, sizes | 5, 7 |
| 6: artwork sets and blanks | 6 |
| 7: placement and composition | 6, 10 |
| 8: member ordering and lookup | 7, 8 |
| 9: admin orders and statuses | 7, 9 |
| 10: CSV formats | 9 |
| 11: desktop/mobile/dialogs | 3, 5, 8–10 |
| 12: data invariants | 2, 4–7 |
| 13: Pi hosting | 1, 11, 12 |
| 14: prototype boundaries | Global constraints; 1, 4, 6, 8, 12 |
| 15: acceptance | Each task's tests; 12 final acceptance |

## Planning references and implementation assumptions

Official references consulted for this plan:

- [Next.js 16](https://nextjs.org/blog/next-16) and [self-hosting](https://nextjs.org/docs/app/guides/self-hosting).
- [Prisma ORM 7 system requirements](https://www.prisma.io/docs/orm/v7/reference/system-requirements) and [driver adapters](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers).
- [Node.js downloads and LTS releases](https://nodejs.org/en/download).
- [Docker platform builds](https://docs.docker.com/build/building/multi-platform/).

Major lines are architectural choices; Task 1 locks actual patched releases and verifies native Linux ARM64 dependencies. There is no claim that an image built from macOS-installed native modules is portable to Linux merely because the CPUs share ARM64.

Operating-system distribution/version, existing Caddy/tunnel file paths, SSH host/user, and GitHub repository URL were not provided. Treat these as execution-time operator configuration, not unresolved product design. Do not rewrite the existing tunnel or guess those values. The plan assumes SSH access and Docker Engine/Compose will be available on the Pi; installation belongs to deployment preparation if absent.

The spec's supplied-logo dependency does not require invented official branding. Keep its placeholder identifiable until the owner provides the actual asset. No email, partial-payment, archive UI, or additional post-creation style-edit controls are added.

## Review and execution handoff

The user requested discussion before plan generation; that discussion is complete and this plan records the agreed choices. Implementation has not started.

Please review the plan before execution. Recommended execution is native implementation in this session with staged tests and a final independent review, because the feature services and data invariants are closely coupled and a single implementer can keep those interfaces consistent. Subagent-driven task implementation/review is an available alternative if the user explicitly chooses it. Do not spawn agents or begin product implementation as part of delivering this plan.
