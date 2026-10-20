# SFBB merchandise ordering — implementation specification

**Specification date:** October 13, 2026  
**Status:** Consolidated product and UI specification from the design session  
**Audience:** Engineers implementing the production application

## 1. Purpose and sources of truth

Build a self-hosted application where San Francisco Brass Band (SFBB) members order seasonal merchandise and administrators manage collections, prepare manufacturer orders, deliver items, and track money owed. The initial merchandise type is a t-shirt, but orders and catalog records should accommodate other merchandise later.

This document captures the latest decisions, including corrections to earlier requirements. Use it alongside the interactive mockups:

- Desktop: `http://127.0.0.1:8765/` — [index.html](../index.html).
- Mobile: `http://127.0.0.1:8765/mobile.html` — [mobile.html](../mobile.html), an interactive phone frame containing the same member application.
- Main behavior: [app.js](../app.js).
- Artwork composition and placement editor: [preview-editor.js](../preview-editor.js).
- Shared-account demonstration: [login.js](../login.js).
- Visual rules and responsive breakpoints: [styles.css](../styles.css).
- Earlier architecture decision: [approved technical direction](superpowers/specs/2026-10-08-sfbb-merch-technical-direction.md).

Run the mockups from the repository root using `python3 -m http.server 8765 --bind 127.0.0.1`. Mockup query parameters such as `?v=mobile-controls` are cache-busting aids, not application features or required production URLs.

For conflicts, apply the latest decisions recorded here. The mockup's current CSS is the reference for exact visual styling; its JavaScript is a behavioral reference, not production storage or security infrastructure. Browser data, sample shirts, sample names, sample artwork, and demonstration credentials are not production seed data.

## 2. Scope and explicit exclusions

### Required

- Two shared credentials: one member account and one administrator account.
- A login screen; no registration or personal member accounts.
- Season-specific merchandise and ordering windows.
- Cart, quantity inputs, checkout, order confirmation code, and order lookup.
- Member order management within the permitted window and progress state.
- Desktop administration through Orders, Merchandise, and Seasons tabs.
- Mobile member ordering and Find my order; no mobile admin dashboard.
- Custom shirt styles, colors, sizes, prices, blank photos, and paired artwork sets.
- Front/back composites and per-style placement editing.
- Admin order editing, cancellation, restoration, and progress management.
- Billing, fulfillment by customer/product, delivery by item/artwork, and T-shirt ordering CSV exports.
- Durable server storage, persistent uploads, and self-hosted operation.

### Excluded from the first release

- Payment processing, payment gateways, subscriptions, or online collection of money.
- Individual member accounts, sign-up, personal passwords, profiles, or password reset flows.
- Required paid services, externally hosted databases, or commercial email providers.
- Email address collection and automated email confirmation in the initial release.
- Mobile administration.

The original request contemplated email, but the approved first-release direction uses an on-screen order code instead. Do not add an email field or make successful checkout depend on email delivery. A later email feature is outside this implementation scope.

## 3. Roles, authentication, and permissions

### Member

After signing in with the shared member credential, the user can view the live collection, order merchandise, and look up an order using its code. The member does not create an account and the order is identified by name and code, not a personal login.

### Administrator

After signing in with the shared admin credential, the user can administer all seasons, merchandise, assets, orders, and exports, as well as use the member shop.

The desktop header has a single Admin link for administrators. Do not add a redundant Admin role badge next to it. Member sessions must not show admin navigation. On mobile, hide the admin link/dashboard for both roles and show the member experience, including when the shared administrator is signed in.

### Login and production enforcement

The mockup presents username, password, Show/Hide password, Sign in, validation errors, and Sign out. Signing in as a member opens the shop; signing in as an administrator on desktop opens Orders.

Demo credentials are `user / band2026` and `admin / admin2026`. These are testing aids only and must not be shipped as production credentials. Remove the visible demo-credentials panel in production.

The original technical direction allowed Caddy Basic Authentication with separate member/admin gates. The subsequently designed login page is the final UI requirement. A suitable implementation is two server-configured shared accounts with server-managed sessions; this is an integration recommendation to preserve that login UI, not a request for individual accounts. Basic Authentication remains acceptable if integrated with the intended experience. Do not silently replace the designed login page with only a browser-native authentication prompt.

Every admin mutation and export must be authorized on the server. Hiding controls or using browser `sessionStorage` is not authorization. Sign out must invalidate the application session and clear the current cart/edit session. Use HTTPS, protected credentials, secure cookies where sessions are used, request-forgery protection for mutations, and rate limiting for login and short-code lookup.

## 4. Seasons and ordering windows

### Fields

Each season has a stable ID, name, opening date, closing date, member announcement, lifecycle state, its own merchandise, artwork sets, and orders.

Persisted lifecycle states in the mockup are Draft, Published, and Archived. Display status is derived:

| Display status | Meaning |
| --- | --- |
| Draft | Unpublished; accepts no member orders |
| Scheduled | Published, but opening date is in the future |
| Orders open | Published and today's date is within the window |
| Closed | Published and closing date has passed |
| Archived | Retained historical season; accepts no member orders |

Evaluate dates in `America/Los_Angeles`. Opening and closing dates are inclusive. In timestamp terms, accept orders from the start of opening day until the start of the day after closing day in that timezone. Do not rely on the client's timezone or clock.

Closing date cannot precede opening date. Published season windows may not overlap, including their boundary dates. Recheck overlap when publishing and when editing dates of an already published season. A draft may overlap while being prepared, but cannot be published with that overlap. Publication also requires at least one merchandise item and a valid uploaded front PNG and back PNG for every artwork set offered by the season’s merchandise. Unassigned additional sets do not block publication. Blank shirt photos remain optional.

### Seasons tab

List every season as a card with its name, display status, dates, merchandise count, active/non-cancelled order count, Manage, and Preview shop. Drafts additionally show Publish season. Place New season above the list.

Do not show the selected-season banner or a settings form at the bottom of this tab. A season card's Manage button selects that season and opens its settings modal.

### Settings modal

Show the season name prominently and provide Season name, Opens on, Closes on, Member announcement, Save season, Cancel, and Delete season. Save validates, persists, refreshes cards/banner/shop, and closes the modal. Cancel or closing the dialog discards unsaved field changes.

A separate archive/unarchive control has not been designed; the retained Archived state is not permission to invent an additional admin workflow without design review.

### Creating a season

New season opens a modal with name, opening/closing dates, and Starting merchandise: empty catalog or copy an existing season. It creates a draft and opens Merchandise for that draft.

By default, the new season receives one new **artwork set** with front/back upload slots. Copying merchandise copies shirt details, colors, sizes, prices, and blank shirt photos. It starts with fresh season artwork and clears the previous artwork placements unless **Also copy the previous season's designs and placements** is selected. That explicit option copies the prior sets and their placements. Never copy orders. Production copies must not share mutable season records; image files can be shared only with safe reference management.

### Deleting a season

Delete season opens a named confirmation describing deletion of its merchandise, artwork, and placements. Keep season returns to settings. Protect seasons referenced by any order, including cancelled orders. At least one season must remain, matching the mockup's empty-state assumption.

After deletion, clear that season's bag/edit session and select another season: an open published season first, then another published season, then the first remaining season. Return to Seasons. Delete assets only when they have no remaining references.

### Selected season and previews

Orders and Merchandise show a highlighted **Selected season** banner with name, date range, status, and Switch season. It applies to all orders, catalog mutations, and exports on those tabs. Do not label it Editing season.

Changing seasons clears the cart and any member edit session. The live shop normally selects the currently open published season. If none is open, it can display a published collection with its appropriate Scheduled/Closed state and ordering disabled.

Admin Preview shop can display any season. It allows a **test bag**, including drafts and single-set seasons. Show the preview explanation and disable checkout with **Preview only — checkout unavailable**. Never submit an order from preview mode, even if the previewed season happens to be open. Regular member ordering is allowed only for an open published season.

## 5. Catalog, shirt styles, colors, and sizes

A season contains merchandise styles, each with name, description, unit price, type, colors, sizes, available artwork sets, blank photos, and placements. A style is more than a sample SVG shape: admins can define a new make/cut using its description and actual uploaded shirt photos.

### Add shirt style modal

Provide:

- Start from: New custom style or an existing/sample style template.
- Required Style name, maximum 60 characters.
- Optional Description, maximum 160 characters.
- Required nonnegative USD price, cent precision.
- Sample shirt shape: Regular short sleeve, Fitted short sleeve, or Long sleeve.
- Color rows with required names and color-picker swatches; Add color and removal of rows during creation.
- Required Available sizes, entered as comma-separated labels; trim and deduplicate them while preserving order.

Defaults: USD 25, one Band blue color, and `XS, S, M, L, XL, 2XL, 3XL`. Sizes are not fixed: labels such as Youth S and 4XL are permitted. Color names are unique within the style, case-insensitively, and limited to 40 characters. The sample shape is explicitly a fallback until real blank photos are uploaded.

New styles are made available with the season's artwork sets. Adding a style opens its Manage style modal so photos can be uploaded. Name, description, shape, and size-list editing after creation are not currently exposed by the mockup; do not assume those extra controls are established UI requirements.

### Merchandise tab and Manage style

The tab begins with filled blue Manage artwork and Add shirt style buttons. Each style has its own section with name, price, and outlined Manage style button in the same header/container, its color/size summary, preview selectors, and front/back previews. Use the available section width; do not leave a fixed narrow preview area with a large empty right-hand region.

Manage style opens a modal containing price, available-set checkboxes when applicable, color management, blank shirt photos, Done, and Delete style. Price, available sets, and uploads save immediately. Colors use their own explicit Save colors action. Price changes affect new lines/orders, not historical order prices.

At least one artwork set remains available for every style. With one season set, apply it automatically and omit the checkbox group. If multiple sets exist, admins choose which are available for the style.

### Colors

Manage style → Available colors has editable Color name and Swatch controls, Add color, Remove on each row, and Save colors. Names are trimmed, required, and unique ignoring case. Swatches are six-digit hex RGB values.

Remove stages deletion until Save colors. Closing without saving leaves the previous color collection unchanged. Protect the last color and any color referenced by an order in that season, including cancelled orders. Give a clear inline explanation when removal is blocked.

On saved removal, remove its color-specific photos and placements, remove unsent bag items using it, and keep all remaining selections, photos, placements, order references, and cart references associated with the correct colors. The mockup remaps array indices. Production should use stable color IDs instead.

Before renaming/recoloring a color, preserve the original ordered color name and swatch in order-line snapshots. Historical orders and delivery/manufacturer reports must not silently change when the current catalog color is edited. New orders use the current catalog color details.

### Delete style

Open a named confirmation. Protect styles used in any order in that season, including cancelled orders. Deleting an unused style removes its blank photos, placements, available-set associations, and unsent bag lines. It does not delete shared artwork sets or styles in other seasons. Refresh the collection and season merchandise count.

## 6. Artwork sets and blank shirt photos

### Core definition

An **artwork set** is one named pair:

1. Transparent PNG printed on the front.
2. Transparent PNG printed on the back.

These are two different artworks belonging to one set, not two alternatives for the shopper to choose independently. Each season starts with one set; additional front/back sets are optional. A cart line selects a set, which determines both printed sides.

This replaces the earlier notion of a single front-only design. In the mockup, `design`/`designs` identifiers now mean artwork-set identifiers. Legacy single image data is interpreted as front artwork only.

### Manage artwork modal

Provide Front artwork and Back artwork upload controls and separately labelled thumbnails. With one set, show Season artwork set and omit the set selector. With multiple sets, show the Artwork set selector. Put creation of another set under **Additional artwork sets (optional)**; its creation modal asks for a required set name, maximum 60 characters, unique ignoring case.

Uploading either side updates that side across all applicable shirt styles and colors. It does not overwrite the other side. Uploaded PNGs retain transparency and use their original colors; do not recolor uploaded artwork automatically.

Delete artwork set opens a confirmation removing both files and this set's saved placements. Protect the season's last set and sets referenced by any order, including cancelled orders. Styles using only the deleted set switch to the remaining set explicitly named in the confirmation; other styles retain their remaining associations. Remove unsent bag lines using the deleted set. Do not delete blank shirt photos.

### Blank shirt photos

Manage style contains **Blank shirt photos** with a color selector and separate **Upload blank front photo** and **Upload blank back photo** controls. These photos must be unprinted shirts. Explain that season artwork is applied separately.

Blank photos are specific to shirt style, color, and side. Uploading a front photo never overwrites the back or another color. Show uploaded thumbnails or a labelled sample-blank fallback. There is no style selector inside a style-specific modal.

Artwork accepts PNG; blank photos accept PNG or JPEG. The mockup's limit is 8 MB per uploaded file. Validate type, actual decoded image content, size, and safe server paths in production. Store assets durably on the Pi; do not depend on browser data URLs.

Missing artwork during setup is allowed and labelled. The sample front drawing is a mockup fallback, not real band artwork; a missing back must not reuse the front artwork. Confirmed production rule: block publication until both valid front and back PNGs are uploaded for every set offered by a shirt style. Unassigned additional sets do not block publication. The mockup currently lacks this check; its sample artwork does not satisfy it. Blank shirt photos remain optional because fallback shirt shapes are supported.

## 7. Preview composition and placement editor

Member cards show one side at a time with Front/Back toggle buttons. Admin Merchandise shows both sides side by side. Clicking either preview image or its Edit button opens the editor to the appropriate side, retaining the chosen color and set. Front/Back captions are distinct bold uppercase labels; Edit is a separate blue action.

The editor handles **placement only**. No artwork or blank-photo upload controls belong there. Explain that uploads are managed in Manage artwork and Manage style.

### Editor controls

- View: Front / Back.
- Color.
- Artwork set selector only if the style has more than one available set.
- Apply placement to: all colors of this shirt style or only this color.
- Horizontal (%), Vertical (%), Width (%), Rotation (degrees).
- Drag the artwork, resize proportionally using corner handles, and nudge using arrow keys.
- Center horizontally, Reset placement, and Save placement.

Position is independent for each style, set, side, and optionally color. Color-specific placement overrides the shared placement for that style/set/side; otherwise use the shared placement, then the default. Blank-photo resolution follows style/color/side, then a shared blank fallback, then the sample shape.

### Geometry reference

The mockup uses a normalized 320 × 310 preview canvas. Coordinates are percentages of the full canvas, including any image letterboxing. Both blank photos and artwork use aspect-ratio-preserving `contain` behavior.

| Property | Default | Allowed range |
| --- | --- | --- |
| Horizontal center | 50% | 0–100% |
| Vertical center | 47.7% | 0–100% |
| Artwork-box width | 25% | 5–90% |
| Rotation | 0° | −180° to 180° |

Numeric fields use 0.1 steps. Ordinary arrow keys move 0.2 percentage points; Shift + arrow moves 1 point. Center horizontally sets horizontal center to 50%. Reset returns all four properties to defaults.

Artwork is fitted into an 80 × 136 normalized box with center `(160, 148)` in the reference SVG coordinate system. For placement `(x,y,width,rotation)`, scale is `(width × 320 / 100) / 80`; transform is `translate(x × 3.2, y × 3.1) rotate(rotation) scale(scale) translate(-160,-148)`. Front/back assets use the same placement convention. Match the editor and storefront composition, including PNG transparent padding and image fitting. Use one shared renderer or equivalent deterministic logic rather than separate inconsistent formulas.

Saving updates member, admin, and bag previews. Production may cache generated composites, but asset or placement changes must invalidate every affected cache entry. Placement changes do not alter order variant identity or price.

## 8. Member shop, cart, checkout, and lookup

### Shop

Use the current open collection, season name, announcement, status, and closing date. Each shirt card shows photo/composite, front/back toggle, name, price, description, selectable color swatches with visible selected color name, size dropdown, quantity input, and Add.

Display Artwork set selection only when the style offers multiple sets. One set is selected automatically and must work without a visible selector. Size is required; default quantity is 1 and must be a positive whole number.

Do not include uneditable marketing badges such as THE BAND FAVORITE, or the removed bottom strip about mixing items/paying with the band/order codes. The existing member hero, brand treatment, and season announcement remain part of the mockup.

### Cart

Use a bag/drawer with item preview, style, artwork-set name, color, size, unit price, editable quantity, plus/minus, Remove, total owed, Continue to checkout, and Keep browsing.

Merge repeated additions of the same actual variant: style, artwork set, color, and size. Different variants remain separate lines. Respect historical color snapshots when comparing an edited order with current catalog variants. Removing a line removes it entirely; decrement cannot produce a zero or negative quantity. Checkout requires at least one line.

### Checkout and confirmation

Collect required full name and optional member note. Display item quantities, variants, prices, and total money owed. Make clear that payment is arranged separately with the band; no payment is collected here.

On submit, validate the published ordering window, merchandise availability, quantities, and prices on the server. Create a durable order atomically and display its code. Generate the code cryptographically, make it unique, and handle collisions. The mockup uses six uppercase characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; normalize lookup to uppercase and trim whitespace.

Confirmation includes the code, Copy order code, amount owed, order summary, applicable edit deadline, and return to shop. No email is required. Admin search by name/code is the fallback when the member loses the code.

Do not trust posted unit prices for new orders. Preserve the original prices of existing lines during permitted member edits; new lines use current validated catalog prices. Administrators have an explicit unit-price override in their editor. Store USD amounts as integer cents, not floating-point arithmetic.

### Find my order

Use a modal with a six-character code input, Look up order, and inline not-found error. On success show code, a single displayed status, order details, amount owed, member note, and season.

Members may edit, cancel, or restore only when their order's season is open **and its retained progress state is Open**. Delivered · unpaid and Complete orders are locked for members; tell them to contact the admin. A cancelled Open order may be restored during the window. Lookups remain available after ordering closes.

Member Edit order loads the existing items into the bag and preserves the order code when checkout saves changes. Cancellation requires a confirmation and marks the order Cancelled without erasing it. Restoration returns the retained order to its prior progress state. Amount owed is zero for Cancelled or Complete orders.

## 9. Admin orders and status workflow

Orders shows selected-season metrics, the three export actions with explanations, search by member name or code, and a table.

Table columns: **Member / order**, **Items**, **Amount owed**, **Status**, and **View**. Do not show both Order state and Status. Non-cancelled rows have a status dropdown. Cancelled rows show a Cancelled badge instead of a disabled dropdown with a contradictory progress label.

| Display status | Meaning and effects |
| --- | --- |
| Open | Not delivered; included in items-to-fulfill count and amount owed |
| Delivered · unpaid | Delivered, payment outstanding; excluded from items-to-fulfill, included in amount owed |
| Complete | Delivered and payment resolved; excluded from items-to-fulfill and amount owed |
| Cancelled | Inactive order; excluded from active metrics and all four exports; owed zero |

Persist cancellation separately from progress so restoration can retain the progress state, but present one combined status to users. Admin dropdown choices are Open, Delivered · unpaid, and Complete. Allow admins to correct progress in either direction; no rigid transition sequence was imposed.

Migrate earlier Delivered, Awaiting Payment, and Fulfilled values to Delivered · unpaid; Unfulfilled and Ready for pickup migrate to Open. Complete and Open remain unchanged.

Metrics: active orders = non-cancelled order count; items to fulfill = total quantities in non-cancelled Open orders; total owed = full line totals in non-cancelled orders not marked Complete. Partial payments were not designed; Complete resolves the full balance.

### Admin View and editing

View opens details with Edit order and Cancel order for a non-cancelled order. Admins may edit/cancel regardless of dates or progress, including closed seasons and Complete orders. Cancelled orders offer Restore order. Require confirmation for cancellation.

Admin Edit order is a direct modal, not a detour through member checkout. Fields: full name, note, editable item rows with style, color, size, artwork set when needed, positive whole-number quantity, nonnegative unit price, Remove item, Add item, Save order, and Discard changes. It must contain at least one valid item to save.

Changing a row's style resets its dependent variant choices and defaults its unit price to the new style price. Unchanged lines preserve their stored unit prices and original color snapshots. Saving preserves order code, season, cancellation/progress state, and updates totals/exports. Discard leaves the order unchanged. An admin can adjust progress separately on the table.

## 10. CSV specifications

Updated 2026-10-20 to match the owner's supplied CSV layouts, omitting email addresses, water bottles, and personalization. Provide four exports for all applicable orders in the selected season, independently of dashboard search. Exclude cancelled orders. No export contains a Season or Status column; Paid?, Fulfilled and Ordered? are intentionally blank manual checklist cells, not exported application status. Waterbottle Ordering is omitted entirely until that product is supported.

### File names

Keep the established season/date filenames: `sfbb-{season-name-slug}-{opening-date}-{report}.csv`. Filename suffixes are `billing`, `fulfillment-by-member`, `fulfillment-by-product`, and `manufacturer-order`. The existing API report IDs `member-delivery` and `product-delivery` remain unchanged. The `product-delivery` download groups by item and artwork set; there is no separate item/artwork export. Slugs normalize Unicode, remove combining accents, lowercase, replace runs outside ASCII letters/digits with hyphens, trim boundary hyphens, limit to 80 characters, and use `season` if empty.

### Billing CSV

```text
Full name,Order code,Total T-shirts,Amount Owed,Paid?,Comment
```

One row per non-cancelled order, sorted by full name then order code. Full name is always column 1 and order code column 2; orders with the same name remain separate billing rows. Sum each order's shirt quantities and use its snapshot-based balance, counting Complete as zero owed but retaining its item quantities and its own comment. Leave Paid? blank. Currency is decimal with two places and no symbol. For nonempty exports, append a blank separator row and a Totals row for shirt quantity and amount owed; leave the order-code/checklist/comment cells blank. Empty exports contain only the header.

### Fulfillment by customer CSV

```text
Name,Item,Artwork set,Color,Size,Quantity,Fulfilled
```

Group by exact customer name and combine matching variants across that customer's orders, including delivered/Complete orders. Print the name on the first item row only, with a blank separator row between customers. Repeat item, artwork set, color and size for each variant; leave Fulfilled blank.

### Fulfillment by product CSV

```text
Item,Artwork set,Color,Size,Quantity,Name,Fulfilled
```

A member-delivery view grouped by shirt item and artwork set, rather than by name or individual color/size variant. Keep all colors and sizes of that item/artwork pair in one section. List customers within each section with their ordered color, size and combined matching-variant quantities. Print Item and Artwork set only on the first row of the section and put a blank separator between sections. Fulfilled remains blank. Include delivered/Complete orders and exclude cancellations. Stable style/set IDs and ordered names distinguish sections; full variant/swatch identity distinguishes rows. Sort sections by item/artwork names and stable identity, then customers by exact name and variants by color/size. Use the `fulfillment-by-product` filename suffix.

### T-shirt ordering CSV

```text
Item,Artwork set,Color,Size,Total,Ordered?
```

Combine matching variants across all non-cancelled orders regardless of progress. Print one row per variant, with Ordered? blank. This remains the `manufacturer-order` endpoint/filename suffix.

### Product labels, identities, and sorting

Item, Artwork set and Color are separate columns in both fulfillment exports and the T-shirt ordering export. Product fulfillment puts Color third, Size fourth, Quantity fifth, Name sixth and Fulfilled seventh. Use ordered snapshots, never current renamed colors or changed prices. Matching variants retain stable style/set/color/size identities and ordered names/swatches. Unit price does not split fulfillment/purchasing variants. Different styles or historical swatches remain separate even if visible labels coincide.

Sort customers by exact name and variants by style name, color name, artwork-set name, then standard clothing size order (XXXS through 6XL; 2X/XXL aliases sort with 2XL and 3X/XXXL with 3XL). Unknown size labels follow standard sizes in deterministic lexical order. Stable identity breaks display ties. Preserve existing per-order identities in the application; name grouping applies only to fulfillment exports. Do not merge different spellings/case variants of customer names.

### CSV encoding and safety

Use UTF-8 with BOM, comma separators, CRLF line endings, and proper quoting of every cell. Escape embedded double quotes. Preserve commas/newlines in names and notes. Neutralize spreadsheet-formula prefixes such as `=`, `+`, `-`, `@`, tab, and carriage return in text cells. Empty exports contain the header only. Every non-separator row has all header cells, including blank manual-checklist cells. Keep the on-page descriptions accurate for each report.

## 11. Visual, responsive, and modal requirements

### Shared visual language

Use SFBB's supplied logo on login and application pages; the blue SF/BB musical monogram is a placeholder. Theme uses primary blue (`#1349df` in the mockup), black/dark ink (`#15191f`), white, pale gray surfaces, fine borders, and Arial/Helvetica/sans-serif typography. Keep spacing, rounding, color swatches, preview backgrounds, and button treatments consistent with current CSS.

Collection-wide actions use filled blue buttons; Manage style remains outlined. Destructive actions use the same typeface, size, weight, and control height as neighboring actions, with a red treatment. This applies to confirmation buttons too.

Admin pages are functional: no removed marketing intros or slogans. Admin tab labels are Orders, Merchandise, Seasons. Member desktop header includes Season shop, Find my order, Bag, Sign out, and Admin only when authorized.

### Mobile

At widths of 600px and below, show only the member experience. Use a compact sticky header with logo, Sign out, Bag, and a second navigation row containing Season shop and Find my order. Collapse product cards into one column. Hide the decorative hero artwork, preserve the season announcement/status, and allow vertical scrolling without horizontal overflow.

Mobile size, quantity, and Add controls align on the same baseline and are **46px tall**, with **14px Arial/Helvetica typography and 20px line height**. Fields use normal weight; Add uses weight 600. The artwork-set dropdown uses matching field typography. Do not apply a lower-priority mobile rule that loses to an older desktop selector.

The mobile bag fills the phone viewport. Checkout, confirmation, and lookup dialogs fit within the viewport and scroll when needed. Keep input controls, totals, errors, and actions legible. Admin-session mobile rendering still opens the shop, not the dashboard. Test at the mockup's 390px content width and at narrower phone widths.

`mobile.html` is a review wrapper, not a required production iframe architecture. Production should serve the responsive member UI directly on a phone.

### Dialog behavior

Use accessible modal dialogs with a clear heading and close button. Trap focus, restore it on close, support Escape, and allow internal scrolling. A deliberate click on the curtain may close a dialog. A pointer press starting inside a dialog and released outside must **not** close it. Dragging across the curtain must also not be mistaken for a click; the mockup checks start/end location and less than 6px movement.

Explicit-save dialogs discard unsaved edits when closed: season settings, order editor, colors, and placements. Immediately saved price/availability/uploads remain saved. Make these distinctions clear in helper text. Confirmation Keep/Cancel actions return to the relevant management dialog without applying deletion.

## 12. Production data model and invariants

The following is an implementation-oriented model, not a mandated Prisma schema. Use stable IDs and foreign keys rather than the prototype's mutable array offsets.

| Entity | Essential fields/relations |
| --- | --- |
| Season | ID, name, opening/closing dates, announcement, lifecycle, timestamps |
| MerchandiseStyle | ID, season ID, type, name, description, USD unit-price cents, fallback cut |
| StyleColor | ID, style ID, name, RGB swatch, display order |
| StyleSize | ID, style ID, label, display order |
| ArtworkSet | ID, season ID, name, front asset ID, back asset ID |
| StyleArtworkSet | Style ID, artwork-set ID, availability/display order |
| Asset | ID, validated media type, dimensions, byte size, durable path, ownership/reference metadata |
| BlankPhoto | Style ID, color ID or shared fallback, side, asset ID |
| Placement | Style ID, set ID, side, color ID or shared scope, x/y/width percentages, rotation |
| Order | ID, unique lookup code, season ID, full name, optional note, progress, cancellation flag, timestamps |
| OrderLine | Order ID, stable style/set/color/size references, positive quantity, unit-price cents, ordered display/color snapshots |

Each season owns its catalog associations and sets. Each style has at least one color, size, and available artwork set. Each set has two side-specific asset slots, even if temporarily empty during setup. Reference checks for destructive actions include cancelled orders.

Snapshot order-line descriptions needed for reports and lookup, especially unit price, style/set names, size label, and ordered color name/swatch. Do not recompute historical amounts from current catalog prices. Use transactions for order submission/edit/cancel/restore, color changes, and deletion/reference updates. Recheck window and authorization at mutation time, not just when displaying controls. Avoid duplicate submissions with idempotency handling and stale-edit protection; an audit trail is a recommended implementation safeguard for shared admin credentials.

Stable color IDs should eliminate the mockup's reindexing complexity. If migrating mockup data, map existing index references to stable IDs and preserve color-specific blank photos and placements. Do not copy obsolete product-tag fields into a user-facing feature.

## 13. Hosting and technical direction

The approved stack is a single Dockerized **Next.js + TypeScript** application with **SQLite** and **Prisma**, hosted on a Raspberry Pi 5 with 8 GB RAM and a 64-bit OS. Development and production container builds run on an Apple Silicon Mac; the deployment image targets `linux/arm64`. Caddy and Cloudflare Tunnel are already installed directly on the Pi’s OS. Source code lives on GitHub; deployment is manual, using a built container image transferred from the Mac. Persistent database and image storage is on the Pi’s microSD card. Backups are manual and must cover both the database and uploaded assets; provide backup and restore commands rather than an automated backup service. Use persistent Docker volumes for the database, artwork, blank photos, and any generated composite assets. Backup the database and referenced assets together, and test restoration.

Serve at `sfbb.holtzman.io` using Caddy behind an existing Cloudflare Tunnel. No paid services or externally required application services. Do not introduce a separate database service or hosted image/email/payment dependency as part of this build. The domain is already set up; production routes should be stable and authentication applies to both pages and their APIs/assets as appropriate.

The application must persist orders and uploads across browser tabs, devices, sign-out, server restarts, and deployments. Serve only validated assets, constrain image decode sizes, and maintain safe file permissions. Store shared-account secrets outside source control. Provide clear deployment, backup, restore, and credential-configuration instructions.

Framework/library versions, exact route naming, API structure, upload processing library, and composite cache strategy are engineering choices. They must preserve this specification and should be documented in the implementation rather than inferred from the static mockup.

## 14. Prototype boundaries and unresolved policy details

Do not implement these prototype shortcuts as production behavior:

- `localStorage` is used for orders/seasons/catalog/placements; production is server-backed.
- Uploads are data URLs and session-only; production assets are durable.
- Login credentials and role state are client-side demonstrations.
- The mobile iframe is a presentation wrapper.
- Sample front artwork, sample shirt SVGs, and seed order codes are illustrative.
- Legacy arrays store color indices; production should use stable IDs.

The earlier Basic Auth architecture note predates the designed login page; reconcile authentication with the final UI as described in section 3. Both real artworks are required for every offered set before publication; this rule was confirmed after the mockup was completed. Archive UI, post-creation size/name/description editing, partial payments, finished-shirt photo uploads distinct from blank photos, and email are not established additional features. Preserve the specified scope; raise any necessary policy decision rather than inventing a new flow.

## 15. Acceptance checklist

### Members and mobile

- Both shared logins work without registration; members cannot access admin APIs.
- Desktop and mobile show the same catalog/order data; mobile has no admin dashboard.
- Front/back previews use the correct side of one selected set.
- A single-set shirt adds successfully without a visible set dropdown.
- Invalid/missing size and non-integer/zero quantities show useful errors.
- Same variants merge; different sizes/colors/sets do not.
- Cart edits/removal update quantities and totals; empty carts cannot check out.
- Submission succeeds only for open published seasons and returns a unique six-character code.
- Lookup displays persisted order details; member editing/cancellation/restoration respect both dates and Open progress.
- Mobile login, product controls, bag, checkout, confirmation, lookup, and permitted order actions fit and scroll correctly.
- Mobile size/quantity/Add heights and typography match exactly.

### Administration

- Selected season appears on Orders/Merchandise, never Seasons.
- Season creation/copy, settings Save/Cancel, inclusive dates, publication, and overlap rejection work.
- Settings and management live in modals; no settings form remains below the season list.
- A preview bag works for drafts but cannot submit an order.
- Custom styles support named colors/swatches, arbitrary sizes, prices, and sample shapes.
- Add/edit/remove colors validate correctly; historical color details and asset associations survive.
- Front/back artwork uploads are independent and paired; blank-photo uploads are clearly separate.
- Both preview images and Edit actions open the correct side with the selected set/color.
- Drag/resize/nudge/numeric placement, scopes, fallback resolution, centering/reset, and save refresh work.
- Admin order editing works after closure and on delivered/Complete orders; discard does not mutate the order.
- Admin cancel/restore preserves records and updates totals/exports.
- Status options are Open, Delivered · unpaid, Complete; cancelled rows show one Cancelled badge.
- Deleting seasons/styles/sets/colors enforces order-reference and minimum-count rules and correctly refreshes references/bags.
- Dragging out of a modal does not dismiss it; intended curtain clicks do.

### Exports and durability

- All exports use the selected season, exclude cancellations, and omit Season/Status columns.
- Filenames identify season and opening date.
- Billing totals and Complete-zero balances are correct.
- Member delivery lists variants by member/code with quantities and notes.
- Manufacturer ordering combines variants across progress states without splitting them by status.
- CSV quoting, Unicode, multiline notes, formula neutralization, and empty results are handled.
- A production restart and backup restore preserve orders, photos, artwork sets, and placements.
