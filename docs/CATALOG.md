# Catalog implementation and handoffs

Stage 5 adds production shirt style administration to the selected season's Merchandise tab. The static mockups and `SFBB-MERCH-SPEC.md` remain the design authority. Artwork/blank-photo uploads and durable image composition are Stage 6; placement editing is Stage 10. The current previews are labelled sample blanks and never substitute invented artwork for a missing front/back PNG.

## User interface

The Merchandise panel uses its full width. The collection toolbar has filled blue Manage artwork and Add shirt style actions; Manage artwork remains disabled until Stage 6. Each style's name, price, and outlined Manage style button share one header. Color/size summaries, color preview selection, and separate front/back blanks fill the section. The set selector is omitted when only one set is available for that style. If a saved color or association disappears, the preview falls back to the first remaining color/set by stable ID.

Add shirt style is a modal. It offers New custom style, regular/fitted/long-sleeve samples, and styles from this season as value templates. Defaults are $25, Band blue, and XS through 3XL. Templates prefill editable values; they do not copy uploads, placements, orders, or IDs. The server validates the optional existing template ID belongs to the target season. Creation requires name (trimmed, 1–60 characters), description (trimmed, up to 160), nonnegative integer price cents, a sample cut, colors, and ordered sizes. The UI parses USD without floating-point rounding. Comma-separated sizes are trimmed and deduplicated ignoring case/Unicode/extra whitespace while retaining the first label and order; labels such as Youth S and 4XL are allowed. Blank labels from UI separators are ignored; the resulting list must be nonempty. Direct API input cannot contain blank labels.

A new style receives every artwork set in this season and opens Manage style. Later edits to name, description, cut, or size list are not exposed, matching the established mockup. Manage style contains immediate price saving on blur/Enter, immediate artwork availability saving when multiple season sets exist, staged color rows with explicit Save colors, Done, and named Delete style confirmation. Keep style returns to the same unsaved color draft. Done discards only unsaved color edits; successful price/availability changes remain saved. Save failures remain visible inside the modal. Stage 6 will replace the labelled blank-photo placeholder with color/side-specific uploads.

## Integrity and transactions

All service entry points require an admin actor; every API endpoint additionally checks the genuine session and, for mutations, same origin and session-bound CSRF. Unknown fields are rejected. Strict UUID, version, price, name, and six-digit hex validation precedes writes. Hex values are stored uppercase. Requests are limited to 32 KiB; color/size/set arrays are capped at 100 entries.

Color identities never shift when edited or reordered. Names are unique within the style after Unicode normalization, trimming, whitespace normalization, and case folding. Each existing ID must belong to that style and appear only once. Color renames/swaps use temporary normalized names inside the transaction before applying the final names, avoiding transient uniqueness failures. Display positions are explicit.

A style always retains at least one color, size, and artwork association. A removed color referenced by any order line, including cancelled orders, is protected. The UI disables its Remove button and explains why. A removed unused color cascades only its own scoped photo/placement records; shared/all-color rows and other colors remain intact. Shared asset rows/files are retained until the Stage 6 unreferenced-asset cleanup can safely remove them.

An artwork association may be removed from current availability without altering historical ordered variants or deleting the season set. At least one same-season set must remain. Changed availability returns removed set IDs for unsent bag invalidation. Adding styles or offered sets in a published season runs the shared publication-readiness check inside the write transaction; incomplete front/back sets cannot become offered. Deleting the last style in a published season is blocked. Drafts remain editable with missing artwork.

A style used by any order, including cancelled orders, cannot be deleted. Unused style deletion cascades its colors, sizes, photos, placements, and associations while preserving shared season artwork and other styles. Historical order lines retain their price, style/set names, color name/hex, and size label. Current price/color edits never rewrite snapshots. No legacy browser/mockup order import is supported.

All mutations use serialized SQLite transactions and expected style versions. A successful edit increments the style version and its parent season version; creating/deleting styles increments the season version. Stale updates return 409, and failed changes roll back completely. Consumers must use the returned style version for their next immediate save and refresh season summaries/settings versions.

## Endpoints

All endpoints use the Node runtime, dynamic handlers, and `Cache-Control: no-store`.

| Endpoint | Method | Contract |
| --- | --- | --- |
| `/api/admin/seasons/:id/catalog` | GET | Styles, ordered color IDs, and season artwork sets |
| `/api/admin/seasons/:id/catalog` | POST | CreateStyleInput; returns the new style |
| `/api/admin/styles/:id/price` | PATCH | expectedVersion, unitPriceCents |
| `/api/admin/styles/:id/colors` | PATCH | expectedVersion, colors: [{id?, name, hex}] |
| `/api/admin/styles/:id/artwork-sets` | PATCH | expectedVersion, setIds |
| `/api/admin/styles/:id` | DELETE | expectedVersion; returns deletedStyleId |

Style responses contain stable color/size IDs and ordered artwork IDs. Color updates add `removedColorIds`; availability updates add `removedSetIds`. The browser emits `sfbb:catalog-change` with `{seasonId, styleId, removedColorIds?, removedSetIds?, deletedStyleId?}` after successful changes. Stage 8's live cart must subscribe and remove only affected unsent variants, persist the updated bag, and reset relevant previews. It must also validate persisted variants against the current catalog when loading. No production cart exists yet, so this stage establishes the event/response contract rather than inventing a second bag format.

## Verification

Real migrated SQLite integration tests cover creation/normalization, arbitrary sizes, duplicate colors, zero/fractional price boundaries, cancelled-order history, color removal and scoped dependents, name swaps, foreign/duplicate IDs, artwork availability, published readiness, unused style deletion, and competing stale writes. Browser tests cover custom/sample creation, immediate price/availability saves, last-set protection, explicit color saves/removal, unsaved-color discard, named deletion, CSRF, stale versions, and member/anonymous access rejection. The original authentication and season suites remain part of the regression run. Catalog administration is intentionally skipped on mobile.
