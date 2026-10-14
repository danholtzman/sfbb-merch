# Season implementation and handoffs

Stage 4 implements season administration in the production app under `web/`. The original static mockups remain the design reference. Shirt style management, uploads, order management, and the full member preview bag arrive in subsequent stages.

## Admin behavior

The desktop admin page contains Orders, Merchandise, and Seasons tabs. Orders/Merchandise share a Selected season banner showing the name, inclusive dates, status, and switcher. Seasons lists all seasons and has no selected-season banner or inline settings form. Each card shows style and non-cancelled order counts, Manage, Preview shop, and Publish season for drafts.

New season opens a modal and creates a draft. Manage selects the corresponding season and opens a settings modal. Save closes it and refreshes the cards/banner. Cancel, Escape, or the close button discard unsaved changes. Delete opens a named confirmation in the same dialog; Keep season returns to the unsaved form. The server protects seasons with any orders, including cancelled orders, and the last remaining season. Successful deletion returns to Seasons and chooses an open published season, another published season, or the first remaining season in that order.

The reusable native dialog traps focus, restores it when dismissed, scrolls internally, and closes on a deliberate curtain click. A press inside followed by release outside, or dragging along the curtain, does not dismiss it. Buttons and fields inherit page typography and use consistent heights.

Switching seasons or deleting a season clears `sfbb:cart` and `sfbb:editing-order` from available local/session storage and emits `sfbb:season-change`. Stage 8 must subscribe to this event and bind member state to both the verified session and season. Storage-disabled browsers still complete the operation.

## Initialization and clock

After authentication, the admin server page explicitly calls the existing idempotent `initializeDatabase` helper. A fresh migrated database receives one empty First season draft, with dates equal to today's Los Angeles date and an empty paired artwork record. Existing/restored data is preserved; no demo catalog is shipped. Stage 11 may call the same helper at startup. Neither module imports, production builds, public health checks, nor deletion initialize the database.

Stored lifecycle values are DRAFT, PUBLISHED, and ARCHIVED. Derived labels are Draft, Scheduled, Orders open, Closed, and Archived. There is no archive/unarchive action. Ordering opens at midnight on the opening date and closes at midnight on the day after the closing date in `America/Los_Angeles`, including DST transitions. No other lifecycle accepts orders.

## Write contracts

Admin-only endpoints, Node runtime, dynamic rendering, and `Cache-Control: no-store`:

| Endpoint | Method | Body/result |
| --- | --- | --- |
| `/api/admin/seasons` | GET | Season summaries and counts |
| `/api/admin/seasons` | POST | Settings plus `copyFromSeasonId: UUID|null`, `reuseArtwork: boolean`; new draft |
| `/api/admin/seasons/:id` | PATCH | Settings plus `expectedVersion`; updated season |
| `/api/admin/seasons/:id` | DELETE | `expectedVersion`; preferred remaining `selectedSeasonId` |
| `/api/admin/seasons/:id/publish` | POST | `expectedVersion`; published season |

Settings contain `name` (trimmed, 1–80 characters), `opensOn`, `closesOn` (real ISO calendar dates), and `announcement` (trimmed, maximum 2000 characters). Closing cannot precede opening. JSON request bodies are bounded at 16 KiB to accommodate UTF-8 announcements. Every mutation requires a verified admin session, matching origin, and session-bound CSRF token. Unknown fields are rejected. Route IDs and versions are validated; no client-supplied role or clock is trusted.

Writes use the shared serialized SQLite transaction helper. Settings/publish/delete require the expected version; settings/publication atomically increment it. Stale records return 409. Publication and changes to published dates check overlap within the transaction, including a shared boundary day. Draft date ranges may overlap.

Publication requires at least one style, at least one color/size/set per style, and valid PNG asset metadata for both sides of every offered set. Offered means associated with at least one style in this season. Unassigned incomplete extra sets do not block publication; blank photos are optional. All missing sides are returned together as field errors and displayed in the admin UI. Stage 6 must ensure asset metadata refers to durably validated stored uploads; metadata alone is not a new upload mechanism.

## Copying and deletion

Copying creates new season-owned style, color, size, set, photo, and placement records. Style descriptions, prices, cuts, positions, colors, sizes, and blank-photo asset references survive copying. Default copying creates exactly one fresh paired artwork record, assigns it to every copied style, and carries over no placements or old artwork. Explicit reuse instead copies all set definitions and their asset references, style associations, and placements. Color-specific scope keys and placement references are remapped to new IDs. No orders or historical snapshots are copied.

Shared asset rows/files are retained after season deletion. Stage 6 cleanup may remove only unreferenced files; deleting one copy must never remove another season's asset. Database order-reference restrictions remain the final safeguard. Invalid cross-season source associations fail and roll back the whole copy.

## Preview and later stages

`/shop?previewSeasonId=<uuid>` is guarded on the server for admins and permits any season lifecycle. It displays the season/announcement and **Preview only — checkout unavailable**. Invalid/nonexistent IDs and member attempts return 404. Product cards and test bags remain Stage 8 work. Order submission must reject preview mode even when the previewed season is open.

Stage 5 integrates catalog controls into the selected Merchandise panel; Stage 9 integrates Orders/reports. Keep season settings in this modal and carry the selected ID into every operation. Catalog/upload services must preserve the published-season readiness invariant when modifying offered definitions. Asset cleanup and missing-file handling remain Stage 6 responsibilities.

## Verification

`tests/integration/seasons.test.ts` exercises real migrated SQLite databases, inclusive DST boundaries, strict input/admin validation, readiness, overlapping publications/edits, concurrency, safe copying, stale writes, and deletion protection. `tests/e2e/seasons.spec.ts` exercises modal creation/edit/delete, selection/banner visibility, cancellation, backdrop gestures/focus, missing-side publication errors, preview, and authenticated endpoints. Browser tests use a disposable catalog fixture; it is never part of production initialization. Admin-specific tests skip the mobile project because the admin UI is desktop only.
