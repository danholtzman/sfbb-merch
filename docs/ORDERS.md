# Order services and HTTP contracts

Stage 7 implements authoritative order creation, code lookup, member/admin editing, cancellation, restoration, progress corrections, and stable cart identity/total helpers. Member ordering/lookup UI is Stage 8; the admin order dashboard/editor/reports are Stage 9. No email, payment processing, or individual account creation is introduced.

## Input and pricing

A new order contains seasonId, fullName, optional note, and 1–100 item lines. Full name is trimmed, nonempty, and limited to 100 characters; note is trimmed and limited to 2000 characters, defaulting to empty. Each line contains stable style, artwork-set, color, and size UUIDs plus a positive 32-bit integer quantity. New-order input rejects unit prices and unknown fields. The server validates that all variants belong to the selected season/style and that the set is currently offered with a valid front/back PNG pair, then reads current prices and snapshots from the catalog.

Repeated new-order variants merge quantities. Integer-cent totals use BigInt internally and reject values above JavaScript's safe-integer range before any order is written. Unit prices remain nonnegative 32-bit integer cents. Cart helpers do not mutate inputs and distinguish original line IDs, unit prices, and historical names/swatches from current catalog variants; recoloring the catalog must not silently merge historical items into new ones.

## Creation, time, and retries

A new order requires a published, currently open Los Angeles window. The server checks inside the serialized write transaction. Runtime services obtain a fresh server clock after entering the transaction, so time spent waiting for another writer cannot admit checkout after closing. Draft/archived/closed seasons are rejected even for admins. Preview context is rejected independently of whether the season is open. The route recognizes the explicit X-SFBB-Preview: 1 marker, previewSeasonId query context, and same-origin preview Referer; Stage 8 must retain the marker and keep preview checkout disabled. These markers supplement, rather than replace, authoritative season/variant checks.

The Idempotency-Key header is required (1–128 ASCII letters, digits, underscore, colon, or hyphen; a client UUID is recommended). Keys are bound to a live server session and a SHA-256 hash of the trimmed contact fields and merged/sorted variants. Same-session identical retries return the original cached confirmation, including after ordering closes. A changed payload with the same key returns 409. Another session has its own key namespace. The record, order, and lines commit together and expire with the session. Subsequent lookup returns current order state if the cached original confirmation predates edits/cancellation.

Codes use six cryptographically random characters from ABCDEFGHJKLMNPQRSTUVWXYZ23456789. Each byte selects one of exactly 32 symbols without modulo bias. Global uniqueness is checked under the write transaction and enforced by SQLite; up to 20 collision retries are attempted before a retryable 503. Codes do not change during edits or cancellation/restoration. No demo-order import or legacy code-alphabet conversion is supported.

## Editing and history

Member rows may include originalLineId. An unchanged existing variant preserves its original unit price, style/set names, color name/hex, and size label; quantity may change. New or changed variants require current availability and current server prices. Existing unchanged variants can remain when their association has subsequently been removed from current availability. Original IDs must belong to that order and appear at most once. Admin rows additionally require explicit unitPriceCents; an override may change price while unchanged variants retain their snapshots. Changing variant IDs obtains current catalog snapshots.

Writes retain original row IDs when provided, add new IDs for new rows, and remove omitted rows. At least one line remains. Saving retains order ID, code, season, cancellation, and progress and increments its version. Expected-version compare-and-swap happens inside the transaction; competing edits return 409 without partial changes.

Members can edit/cancel/restore only while the order's season is open and retained progress is OPEN. Cancelled orders must be restored before member editing. Admins bypass member window/progress restrictions while preserving all record/variant/quantity validation. Admin editing can retain cancellation. Cancellation preserves snapshots/progress and yields zero owed; restoration returns to retained progress. COMPLETE also yields zero owed. Progress corrections go both ways between OPEN, DELIVERED_UNPAID, and COMPLETE; restore a cancelled order before changing progress.

## Lookup and authorization

Lookup trims and uppercases codes and accepts only the generation alphabet. Invalid and unknown codes use the same generic 404. Failed attempts commit their rate-limit counts before the error is returned: ten failures per session plus trusted address in a fixed 15-minute window, then 429. Valid lookups do not reset failure counts. Failed member edit/cancel/restore code guesses use the same bucket, preventing an alternate-endpoint bypass. Lookups remain available after ordering closes.

Every service rechecks the live session, role, and expiration within the transaction. HTTP routes use the existing session/origin/CSRF guards, derive client addresses only from the configured trusted proxy, and return private no-store JSON. Lookup uses POST so code entry is not a lookup URL query. Admin name/code search is protected by admin authorization and scoped to a season. It normalizes Unicode/case for comparison and limits search text to 128 characters. No member name-search endpoint exists.

## Endpoints

All JSON bodies are strict, bounded to 64 KiB for item-bearing writes (4 KiB for lookup), and use existing wrapped data/error responses. IDs in admin routes are UUIDs; member routes use codes.

| Endpoint | Method | Input |
| --- | --- | --- |
| `/api/orders` | POST | SubmitOrderInput; Idempotency-Key header |
| `/api/orders/lookup` | POST | code |
| `/api/orders/:code` | PATCH | expectedVersion, fullName, note?, lines with originalLineId? |
| `/api/orders/:code/cancel` | POST | expectedVersion |
| `/api/orders/:code/restore` | POST | expectedVersion |
| `/api/admin/orders?seasonId=…&search=…` | GET | Protected selected-season search |
| `/api/admin/orders/:id` | PATCH | expectedVersion, fullName, note?, admin lines with unitPriceCents |
| `/api/admin/orders/:id/cancel` | POST | expectedVersion |
| `/api/admin/orders/:id/restore` | POST | expectedVersion |
| `/api/admin/orders/:id/progress` | PATCH | expectedVersion, progress |

## UI handoffs

Browser code should import code normalization from `code-format.ts`; `code.ts` contains Node cryptographic generation and is server-only. Stage 8 must persist the same checkout UUID while retrying an unchanged submit and use a new UUID after a definitive payload change/new checkout. Clear it after confirmation. Include originalLineId and preserved snapshot fields in an edited bag; new additions use current catalog identity. Member edits use the existing code/version and preserve the code upon confirmation. Enrich lookup presentation with current server-side season metadata for its name/deadline and edit eligibility; the core OrderView currently returns seasonId. Historical swatches/sample blanks must use the stored colorHex. If an original set is no longer offered, resolve its preview from the validated original order line instead of treating it as a newly selected variant. Bind bag/edit state to the verified session and season and consume the previous stages' catalog/season/signout invalidation events. Preview checkout must remain unavailable and its request marker retained.

Stage 9 uses these admin-only APIs and current versions for its editor, progress dropdowns, and name/code search. Reports must read current full-season orders without search filtering, exclude cancellation, and use historical line snapshots/amount-owed semantics.

## Verification

Real SQLite tests cover merged quantities, integer totals, strict contact/variant input, server pricing, normalized idempotency, collision retries, exact DST boundaries, fresh transaction clock, preview/closed creation, historical edits, stale concurrent writes, cancellation/restoration/progress, failed-code throttling (including mutations), and revoked sessions. Cart/code tests cover immutable merges, snapshot-sensitive identity, bounded quantities/totals, and the code alphabet.

Order HTTP acceptance runs against real uploaded paired PNGs and a published disposable season in both browser projects. It verifies CSRF, preview refusal, concurrent replay, changed-payload conflict, member edits, stale writes, admin-only search, corrections, and restoration. The default browser runner uses separate fresh-server passes for UI regression and the @orders-api tests; historical test orders cannot be erased through production APIs, so this isolation preserves both order-deletion safeguards and the earlier last-season scenario. Explicit file arguments still run directly. No production records are used by tests.

## Optional email extension

The later optional Resend extension is described in [ORDER-CONFIRMATION-EMAILS.md](ORDER-CONFIRMATION-EMAILS.md). It adds an optional new-order email request after commit; checkout and the order-code lookup remain independent of email delivery. The original stage descriptions above record the initial implementation scope.
