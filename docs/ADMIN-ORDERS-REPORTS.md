# Admin orders and CSV reports (Stage 9)

The desktop Orders tab uses the selected-season banner. It shows every order in that season, one combined Status column, and server-backed details/editor dialogs. The mobile admin session continues to show the member shop; this dashboard is not a mobile administration flow.

## Dashboard and mutations

Metrics are calculated from all loaded orders in the selected season, independently of search:

- Active orders: non-cancelled order count, including Complete orders.
- Items to fulfill: summed quantities in non-cancelled Open orders.
- Total owed: complete stored line totals for non-cancelled orders except Complete, whose balance is zero. There is no partial-payment calculation.

Search matches member name or order code, case-insensitively with Unicode compatibility normalization. It filters displayed rows only. The server list endpoint remains `/api/admin/orders?seasonId=<UUID>`; the existing optional server search is also available for API consumers. Changing selected seasons mounts a new dashboard, resets search/dialog state, and follows the existing bag/edit-session clearing behavior.

Status choices are Open, Delivered · unpaid and Complete. A change saves immediately through the versioned progress API; the control shows the last server-confirmed value and is disabled while saving. Admins may correct progress in either direction. Cancelled rows display one Cancelled badge instead of a contradictory disabled status select. View and status controls are 40px tall; the View arrow stays on one line.

View opens saved item details, code, note, season and the single displayed status. Edit order and Cancel order are available for active orders regardless of ordering dates or progress. Cancellation requires a named confirmation; Keep order returns to details. Cancelled orders offer Restore order, preserving prior progress and all snapshots. Successful mutations immediately update the local table/metrics and refresh season order counts.

## Direct admin editor

Edit order opens a separate explicit-save dialog. It has full name, optional note, item rows, Add item, Remove item, Save order, and Discard changes. Each row has style, color, size, positive whole-number quantity and an explicit USD unit-price override. Artwork-set selection appears when a choice is needed, including a retained historical set no longer offered. A single available set is implicit. At least one row is required; the server limits an order to 100 input rows.

Opening the editor refreshes the selected season's catalog. Changing a row's style resets its color, size, artwork set and default price to that style; quantity and the original line reference are retained. Existing rows start with stored prices. Unchanged variant identities preserve ordered style/set/color/size descriptions and swatches, including after the catalog color is renamed/recolored. Changing only quantity or explicit price does not rewrite those snapshots. Adding/changing variants is validated against the current season catalog by the server.

An unavailable historical set can be retained only on its original unchanged variant; changing its color/size resets it to a currently offered set. Original line IDs must belong to the edited order and cannot be repeated. Saves retain code, season, cancellation and progress, and use the original order version. A stale save displays an error while keeping unsaved fields intact; discard/reopen loads the latest saved order. Closing/discarding the editor leaves server data unchanged. Cancelled/Complete owed amounts remain zero even when an admin edits item prices.

All mutations use the existing server role, same-origin and CSRF checks. Hiding controls does not authorize requests. No payment or email integration is added.

## Report downloads

`GET /api/admin/reports/{billing|member-delivery|product-delivery|item-artwork-delivery|manufacturer-order}?seasonId=<UUID>` requires a live admin session. The service rechecks expiry inside the database transaction, reads season metadata and its complete order set together, and returns a private/no-store CSV attachment with nosniff. It never uses dashboard search. Members/unauthenticated requests receive 403/401; unknown report names or malformed IDs are rejected.

All reports exclude cancelled orders, omit Season/Status columns, and identify the collection in the filename:

`sfbb-{season-slug}-{opensOn}-{report}.csv`

The slug uses Unicode decomposition, removes combining marks, lowercases ASCII letters/numbers, converts other runs to hyphens, trims boundaries, limits to 80 characters, and falls back to `season`. The opening date is ISO `YYYY-MM-DD`.

| Report | Exact header | Row behavior |
| --- | --- | --- |
| Billing | `Full name,Order code,Total T-shirts,Amount Owed,Paid?,Comment` | One row per order, full name first/code second, original comment, blank Paid?, blank separator and Totals footer. Complete contributes zero owed. |
| Fulfillment by customer | `Name,Product Name,Size,Quantity,Fulfilled` | Customer name on first item only; matching variants combined across that customer's orders; blank separators/checklist. |
| Fulfillment by product | `Product Name,Size,Name,Quantity,Fulfilled` | Product/size on first customer only; per-customer quantities; blank separators/checklist. |
| Delivery by item/artwork | `Item,Artwork set,Name,Color,Size,Quantity,Fulfilled` | Sections by item/artwork across all colors/sizes; customers and matching variant quantities within each section; blank checklist/separators. |
| T-shirt ordering | `Product Name,Size,Total,Ordered?` | Variant totals across all progress states; blank Ordered?. |

As requested on 2026-10-20, email, water-bottle and personalization columns and the unsupported water-bottle report are omitted. Product labels combine ordered style, color and artwork-set names, retaining stable variant/swatch identities. All reports exclude cancelled orders; fulfillment/purchasing includes delivered/Complete orders. Billing sorts by full name then order code and keeps same-name orders separate. Fulfillment groups customers by exact saved name; sort customers by exact saved name and variants by style/color/set, standard clothing-size order, and stable identity. Distinct spellings of a name remain separate. No data migration or new checkout fields are required. Full contracts are in section 10 of SFBB-MERCH-SPEC.md.

Money is integer-cent based. Report quantities and dashboard aggregate sums use BigInt; CSV currency has exactly two decimal places and no currency symbol. Every cell is quoted, embedded quotes are doubled, commas/newlines and Unicode are preserved, record separators are CRLF, and UTF-8 has a BOM. Text beginning with spreadsheet-formula prefixes (`=`, `+`, `-`, `@`, tab, carriage return, or leading whitespace before a formula prefix) receives an apostrophe prefix. Empty results still contain the exact header.

## Verification and release boundary

Tests use disposable migrated SQLite databases and test-only credentials/uploads. The admin browser suite parses actual downloaded files independently of production CSV encoding, checks headers/quantities/notes/filenames, verifies search-independent exports and empty-season exports, and tests role guards. It also covers Closed/Complete editing, price/color snapshots, dependent variant reset, minimum item count, cancel/restore, version conflicts, matching action typography and 40px table controls.

The default browser runner uses four fresh-server passes: existing admin/catalog/auth UI regression, order API acceptance, member flows, and admin orders/reports. Historical order protection is never weakened to delete fixture data. Screenshots are generated for visual inspection and remain untracked. The Stage 10 placement editor and Stage 11/12 release/backup procedures remain separate work; no Pi, Caddy, Cloudflare or production member records are changed here.
