# Member ordering interface (Stage 8)

The production responsive UI is `/shop` and `/find-order`, protected by the existing shared-account session. It consumes real server catalog, image and order services. The root HTML/mobile iframe remain design references; they are not used for production persistence.

## Catalog and previews

`GET /api/member/catalog` selects the open published season, then the most recently opening published collection as a read-only fallback. Drafts/archives are not exposed through live catalog selection. An authenticated admin may request `?previewSeasonId=<UUID>` for any season; this is always a test bag with disabled checkout, even during an open window. Members receive 403 from that API and 404 from the preview page.

Cards use stable style/set/color/size IDs, side-correct composites, color swatches, quantity and required size. Exactly one offered artwork set is implicit. Multiple sets have a selector. Invalid sizes, fractional/zero quantities, unsafe totals and more than 100 bag variants are refused. Removed product badges and the bottom information strip are absent. No online payment or email fields are present.

On phones (≤600px), the sticky header has member navigation only. The live shop also renders for admin sessions at `/admin`; desktop administration stays hidden. The card controls are 46px tall, 14px Arial/Helvetica, 20px line height. The bag fills the viewport. Native dialogs retain focus trapping, Escape, focus restoration, internal scrolling, and intentional curtain-click handling.

## Bag and checkout

The bag is an explicit reducer. Ordinary/test bags use sessionStorage under `sfbb:cart`, bound to the server-verified session UUID and selected season/preview mode. Storage failures fall back to memory. Logout/season-change events clear state. A browser-restored page revalidates the session and reloads if its session UUID changed, preventing reuse of an old in-memory bag. Catalog deletion events remove only affected unsent lines. Restored bags revalidate against the server catalog; changed prices/colors or removed items are announced. Original edited lines retain their stored snapshots. Order-edit state stays in memory during member-page navigation; reloading discards that unsaved edit, leaving the server order intact. It never restores an old edit record as authority.

Before checkout, catalog refresh revalidates all unsent variants/prices. A changed bag remains open for review. Interactive create/edit sends `X-SFBB-Catalog-Version`; the order transaction rejects a stale catalog with `CATALOG_CHANGED` before writing. Original lines preserve ordered unit prices/swatches, and newly added lines use current server prices. New-order payloads contain no trusted client prices.

The checkout attempt's idempotency key is reused for the same payload, including after a lost response, closing/reopening checkout or a page reload within that session. Its sessionStorage envelope is private to that browser tab/session. A successful create or edit clears the bag and displays the server confirmation immediately; a later presentation read is not required to show the order code. Confirmation displays the six-character code, a Copy action with manual-copy fallback, items, amount owed, and the inclusive San Francisco deadline. Payment is arranged separately with the band.

Full name is trimmed/nonempty up to 100 characters; optional note is up to 2000 characters. Stale order conflicts leave the checkout inputs and bag unchanged, with instructions to look up the latest version. Closing a checkout discards its unsaved contact fields; explicit Discard changes clears the order-edit bag without changing the saved order.

## Lookup and member changes

`POST /api/orders/lookup` retains the existing CSRF and persisted failed-code rate limit. Its data extends `OrderView` with current season metadata, server-derived `canEdit`, the current catalog, and original-line front/back preview specifications. Historical preview resolution validates already-authorized order-line references instead of requiring the set to remain offered; sample-shirt swatches come from ordered snapshots. There is no public name search or unauthenticated order endpoint.

Only Open progress during the published season's inclusive ordering window enables member Edit/Cancel/Restore buttons. Cancellation requires a named confirmation; restoration preserves prior progress. Cancelled/Complete balances are zero. Locked orders explain that the member should contact an admin. Mutation-time checks remain authoritative if dates or progress change while a dialog is open. Admin corrections and report controls belong to Stage 9.

## Verification and next-stage boundaries

The member Playwright pass uses an independently migrated disposable database and test-only uploads/credentials. It is separate from admin season-deletion regression tests and order API acceptance: historical orders cannot be purged through public APIs merely to clean up a test. The normal runner executes all three passes. Screenshots are captured for desktop confirmation and 390px/320px mobile shop, bag and confirmation; generated screenshot artifacts stay untracked.

Stage 9 can reuse OrderSummary and the native Modal, but its administrator editor must retain the separate admin mutation/price-override contracts and server role guards. Stage 10 adds saved placement controls while continuing to use the shared compositor. No deployment, real member order, credential change or Pi/tunnel configuration is performed by these tests.

## Optional confirmation email extension

When the operator enables and configures [Resend confirmations](ORDER-CONFIRMATION-EMAILS.md), new-order checkout offers a confirmation email field. Leaving it blank keeps the original flow. Email delivery is best effort; always save the order code shown on screen. This later extension supersedes the initial no-email-field description above when enabled.
