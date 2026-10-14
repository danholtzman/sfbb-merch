# Artwork placement editor

Stage 10 implements desktop admin placement editing. Upload season Front and Back artwork together in **Manage artwork** and unprinted blank photos in **Manage style**. The placement editor contains no upload controls.

## Opening and selecting a target

On Admin → Merchandise, click the full front/back preview image or its blue **Edit ↗** link. Bold uppercase FRONT/BACK labels distinguish the side from the action. The editor opens for the selected shirt style, artwork set, color, and side. View and Color selectors can change the target; Artwork set appears only when more than one set is offered by the style. Saving retains the selected color/set on the merchandise card.

Changing view, color, set, or placement scope discards the unsaved placement draft and loads that target's saved geometry. The editor explains this behavior. Target selectors, save controls, pointer movement, and keyboard movement are disabled while saving. Escape/close and deliberate curtain clicks follow the common modal behavior.

## Geometry and interaction

The shared `Composite` SVG renders the same 320 × 310 normalized canvas in admin previews, member cards, bags, and the editor. Blank photos contain within the full canvas. Artwork, including transparent padding, contains within an 80 × 136 box centered at (160,148). The editor overlays a transparent move target and four corner handles on that exact box; it does not replace the compositor.

Default geometry is `(x:50, y:47.7, width:25, rotation:0)`. Horizontal and vertical positions accept 0–100%; width accepts 5–90%; rotation accepts −180–180 degrees. Numeric inputs allow 0.1 increments. Center horizontally sets only x to 50. Reset placement restores all four default values and requires Save placement to persist.

Drag the artwork to move it. Pointer capture continues the operation outside the hit target. Movement converts CSS pixels through the actual fitted canvas, including letterboxing, into normalized coordinates; it does not use the uploaded image's dimensions. Pull any corner to resize proportionally by radial distance from the center, preserving position and rotation and clamping width. Pointer results round to 0.1. Arrow keys move a focused artwork target by 0.2 percentage points, or 1 with Shift. Arrow keys on a corner adjust width by the same increments. Enter/Space focuses the corresponding numeric position/width input. A vertical guide marks the canvas center.

## Scope, persistence, and conflicts

Placement identity is shirt style + artwork set + side + scope. Apply placement to **All colors of this shirt style** stores the shared geometry; **Only this color** stores an override. Overrides win over shared geometry, which wins over the default. Front/back, styles, and sets remain independent. A color with an existing override opens in Only this color scope. Selecting All colors loads the shared geometry and explains that the current color's override still takes precedence. There is no remove-override control in this stage; Reset in color scope saves an explicit default override.

Admin-only GET `/api/admin/styles/:id/placements?setId=…&colorId=…&side=…` returns the current `CompositeSpec` and the shared/override values and versions. PATCH uses `{setId,colorId,side,values,expectedVersion}`; null color means shared scope and null expectedVersion means the scope was absent. The write transaction validates actual admin identity, CSRF/origin, current style/set association, color ownership, side, ranges, and expected scope version. A stale save returns 409 without overwriting newer geometry. The editor retains the unsaved inputs and asks the admin to close/reopen to review the saved placement. Geometry writes increment only the placement version and do not change order versions, quantities, prices, or variant identity.

## Refresh and verification

Successful saves/uploads/color changes notify mounted previews in the same window and other tabs using a same-origin BroadcastChannel. Focus/visibility changes revalidate, allowing another device's updates to appear when the page becomes active. This is not a continuously pushed cross-device feed. Reads remain authenticated and private/no-store; there are no generated preview files or paid services.

A historical order-edit bag refreshes its stored composite previews via authenticated order lookup only when the server order version still matches the loaded edit version. It preserves unsaved quantities, order snapshots, and the optimistic version. Background image errors leave the draft intact. Normal bags and member/admin cards re-fetch the shared composite endpoint.

Unit and real-database tests cover exact transforms, letterboxed coordinates, nudges/clamps, proportional resize, rotation, centering/reset, scoped precedence, side separation, admin-only metadata, and stale-save rejection. Browser checks exercise actual pointer/keyboard controls with padded transparent front/back PNGs and different colored blank photos, full-image/link entry, one/multiple sets, target switching, stale inputs, and cross-tab normal/historical bag refresh without altering orders. Admin placement checks intentionally skip mobile; ordering and order lookup remain covered on mobile by the member suite.
