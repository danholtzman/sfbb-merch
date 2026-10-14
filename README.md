# SFBB merchandise mockup

The consolidated requirements and current implementation rules are in [SFBB-MERCH-SPEC.md](docs/SFBB-MERCH-SPEC.md). Use that specification with the desktop and mobile mockups; it supersedes older walkthrough details below.

A responsive, dependency-free HTML/CSS prototype with small JavaScript interactions.

## Implementation planning

The agreed stack, publication checks, staged implementation tasks, and manual ARM64 deployment workflow are recorded in [the implementation plan](docs/superpowers/plans/2026-10-13-sfbb-merch-implementation.md). The plan is ready for review; production implementation has not started.

## Preview

Open `index.html` directly, or run:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then visit http://127.0.0.1:8765.

## Try the flows

- Sign in with one of two shared demo accounts: **user / band2026** for member ordering, or **admin / admin2026** for administration. No registration or personal accounts. Sign out from the header; demo sessions last within the browser tab.

- Select shirt designs, colors, sizes, and quantities, add items, adjust quantities, and check out with a full name and optional note.
- Save the six-character confirmation code, then use **Find my order** to view, edit, cancel, or restore the order.
- Try sample code **BR4SS2**.
- Open **Admin** to search orders by name or code, export billing, member delivery, and manufacturer order CSVs, adjust prices, add named designs, choose available designs per item, upload a transparent PNG for a selected design, and change season settings.
- Under **Admin → Merchandise → Manage style → Blank shirt images**, choose a shirt and color, then upload its front and back independently. Both images appear in the editor and the member Front/Back previews.
- Each item on **Admin → Merchandise** displays front and back previews with color and design selectors. These update when shirt images or saved artwork placements change.
- Open **Admin → Merchandise → Edit** on either the front or back preview to choose a front/back view and color, upload a blank shirt and transparent PNG, drag and resize the design, or set its position, width, and rotation numerically. Save a shared placement for all colors or a color-specific override. Blank uploads belong to the selected color and view. Members can switch between front and back previews. Placements persist in localStorage; uploaded images remain session-only.
- Open **Admin → Seasons → New season** to start an empty draft or copy a previous collection. Add merchandise, preview, then publish. Published seasons accept orders only inside their date window; overlapping published windows are rejected.
- Switch **Working season** to view its own merchandise and orders.
- Use each order’s **Status** selector to mark it Open, Delivered · unpaid, or Complete. Cancelled orders cannot change status. Only Open orders count toward items to fulfill; Complete orders are excluded from amounts owed. Existing Fulfilled, Delivered, and Awaiting Payment statuses migrate to Delivered · unpaid.

## Scope

This is a local visual prototype, not the deployed application. Orders are stored in browser localStorage; season settings, catalogs, designs, and fulfillment statuses are also stored in localStorage. Uploaded images live only in the current session. Sample names, products, artwork, season dates, and the SFBB monogram are placeholders. Replace the monogram with the supplied band logo for production.

There is no server database, email delivery, production authentication, or payment processing. The login is a client-side demonstration with two fixed demo accounts; it is not a security boundary. The order-code confirmation follows the previously approved first-release technical direction. The member demo hides admin navigation, and the admin demo opens the dashboard. Production must validate credentials and enforce authorization on the server. Billing CSV excludes cancelled orders and does not include a status column. Member delivery CSV lists item variants by member and order, without a status column. Manufacturer order CSV combines matching item, design, color, and size variants across non-cancelled orders. Season identity is included in filenames rather than columns.

A production application will need separate shared member/admin authentication gates, durable storage, secure order-code lookup, server-enforced season windows, season archiving, and server-side validation. The approved Raspberry Pi/Caddy/Cloudflare hosting direction is recorded in `docs/superpowers/specs/2026-10-08-sfbb-merch-technical-direction.md`.

- Use **Admin → Merchandise → Add shirt style** to define a custom name, description, price, colors, and sizes, or start from an existing style. Upload front and back shirt images afterward; members see the configured colors and size choices.

- Each merchandise item’s **Manage style** dialog has **Delete style** with a confirmation. Styles referenced by this season’s orders cannot be deleted, preserving order details and reports. Deleting an unused style also removes it from the current bag.

- **Manage artwork** opens the design library and PNG upload controls in a modal. Each item’s **Manage style** modal contains its price, available designs, blank front/back uploads, and Delete style action. The Merchandise tab keeps front/back previews and direct placement editing.

- The admin banner identifies the season being edited and its ordering dates. Switch seasons there; edit dates and announcements in the settings modal opened by a season’s **Manage** button under **Seasons**. Click either merchandise preview image or its Edit button to open that side in the placement editor.

- New seasons default to one shared **Season artwork** design. Copying a collection copies shirt details and blank images; reuse previous designs and placements only when the checkbox is selected. Upload the artwork once for all styles. Design selectors and per-style design checkboxes appear only when there are multiple options. **Additional designs (optional)** in the artwork modal keeps multiple-design seasons supported.

- In a season’s **Manage** modal, choose **Delete season** and confirm to remove its collection. Seasons containing any orders are protected, and at least one season must remain. Deleting the selected season clears its bag and switches to another season.

- **Selected season** appears only on Orders and Merchandise. Seasons lists all seasons without a selected-season banner. All three exports are together on Orders: **Billing CSV** has one row per non-cancelled order; **Member delivery CSV** lists variants and quantities by member and order; **Manufacturer order CSV** totals each variant across order statuses.

- Admins can **Edit order** or **Cancel order** from an order’s View modal regardless of season dates or progress. The admin editor supports member name, note, item variants, quantities, unit prices, adding/removing items, and discarding changes. Saving preserves the order code, season, and progress status. Cancellation requires confirmation; cancelled orders can be restored by admins. Billing excludes cancelled orders.

- Admin season previews allow a test bag, including for single-design drafts. Preview checkout is disabled and cannot submit an order. Members can order from the live shop only while a published season is open.

- Artwork is managed as a **front/back set**. Upload both transparent PNGs in **Manage artwork**; that set is shared by the season’s shirt styles. **Manage style** uploads are unprinted front/back shirt photos for each color, not artwork. The preview editor positions the matching artwork side and has no upload controls. Extra sets are optional. Legacy single artwork images are treated as front artwork; uploaded images remain session-only in this prototype.

- **Manage artwork → Delete artwork set** removes both artwork images and the set’s placements after confirmation. Sets used in any orders are protected; at least one set must remain. A style using only a deleted set switches to the remaining set named in the confirmation. Bag items using that set are removed.

- **Manage style → Available colors** lets admins add colors and edit names and swatches. Choose **Save colors** to apply changes to the shop and preview controls. Color indices stay stable for shirt images and placements, and submitted orders retain their original color names and swatches.

- Color rows include **Remove**; click **Save colors** to apply removal. Colors used in orders (including cancelled orders) and the last color are protected. Remaining order/cart color indices, blank photos, saved placements, and preview selections are remapped; bag items in deleted colors are removed.

- **mobile.html** provides an interactive phone mockup. At mobile widths, the member shop, bag, checkout, and Find my order use touch-sized controls and the admin dashboard is hidden. Shared-account login remains available; an admin session opens the member shop on mobile.
