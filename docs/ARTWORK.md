# Artwork, image storage, and composition

Stage 6 implements paired artwork sets, blank-shirt photos, authenticated image delivery, and one shared compositor. Stage 10 adds the [placement editor](PLACEMENT-EDITOR.md); member cards/bags and the editor use the same renderer.

## Admin controls

Manage artwork opens a modal with separate Front artwork and Back artwork slots. With one set, the set selector is omitted. Additional artwork sets (optional) contains a required unique name (trimmed, maximum 60 characters). New extra sets start with empty front/back slots and are not automatically offered by existing styles. Uploading either side updates that side for every style using the set; the other side is preserved. Missing slots are labelled and never filled with fake band artwork.

Delete artwork set names the set and the remaining set that will replace it for styles with no other association. The last set and sets used by any order, including cancelled orders, are protected. Blank photos survive deletion. The request includes the named replacement ID; if it changed concurrently, deletion fails instead of switching to an unexpectedly different set. Offered sets in published seasons must retain complete valid PNG pairs. Uploads and deletion recheck published readiness transactionally.

Manage style now contains Blank shirt photos, a color selector only when multiple colors exist, and separate Upload blank front photo / Upload blank back photo controls. These accept unprinted PNG/JPEG shirts; season artwork is applied separately. Each upload targets the selected style/color/side. A shared blank is supported by the service as a fallback, but the UI uploads to explicit colors. Uploads save immediately and refresh the style version. Unsaved color rows remain staged until Save colors.

## Validation and durable storage

Artwork accepts PNG; blanks accept PNG or JPEG. Each file is limited to 8 MiB, with a 40-million-decoded-pixel engineering limit. Both the declared MIME type and decoded format must agree. Sharp rejects malformed/truncated files and decoder-reported multiple-frame/page content, applies orientation, strips incidental metadata, re-encodes, and preserves PNG alpha and original artwork colors. Canonical output is also bounded to 8 MiB. Expensive decodes run one at a time per app process to bound Pi memory use.

Upload endpoints authenticate admin/session/origin/CSRF before reading file bytes. Multipart bodies are bounded to the file limit plus 64 KiB of envelope overhead, reject duplicate/unknown fields, and never trust an uploaded filename. API paths/versions/colors are validated before a file is stored. References are rechecked within the write transaction, including the expected style version for blank uploads.

Storage is `DATA_DIR/assets` (`/data/assets` in the production container). Generated UUID filenames have PNG/JPG extensions. A new file is written with exclusive creation and mode 0600 to a same-directory pending path, flushed, renamed atomically, and the directory is flushed before metadata is committed. Metadata stores dimensions, MIME, byte size, and SHA-256. The caller then changes its artwork/photo reference transactionally. Disk/decode/stale-reference failure retains the previous referenced image. A promoted but unattached file/asset can remain as an orphan for explicit cleanup; automatic cleanup never races a season copy or upload.

The assets directory must resolve directly under the configured data directory; symlink escapes are rejected. Reads accept only a validated asset UUID and a safe generated storage key, open without following symlinks, and verify file size/hash. Filesystem paths and original filenames never appear in public asset responses. Missing/corrupt files return 404 and previews show an unavailable/setup state. External runtime asset paths are excluded from Turbopack filesystem tracing; they belong in the persistent volume, not the image build.

## Endpoints and concurrency

| Endpoint | Method | Payload |
| --- | --- | --- |
| `/api/admin/seasons/:id/artwork-sets` | POST | JSON name |
| `/api/admin/artwork-sets/:id` | DELETE | JSON expectedVersion, expectedReplacementSetId |
| `/api/admin/artwork-sets/:id/:side` | POST | Multipart file, expectedVersion |
| `/api/admin/styles/:id/blank-photos/:side` | POST | Multipart file, expectedVersion, colorId |
| `/api/admin/styles/:id/placements` | GET | setId, colorId, side query; admin-only spec and scoped placement versions |
| `/api/admin/styles/:id/placements` | PATCH | JSON setId, colorId (nullable), side, values, optional expectedVersion |
| `/api/assets/:id` | GET | Authenticated canonical image bytes |
| `/api/composites` | GET | styleId, setId, colorId, side query; CompositeSpec |

All routes are dynamic Node handlers. JSON uses no-store; image bytes use private/no-store and nosniff. Asset GET requires either shared account; draft CompositeSpec is admin-only. Mutation routes require admin and CSRF. Asset URLs are `/api/assets/<uuid>`; they are the only image URLs exposed by services.

Artwork replacements use expected set versions and increment set/season versions. Blank uploads use expected style versions and increment photo/style/season versions. Set creation increments the season version; deletion increments affected styles and the season. Placement saving validates style/set association, color ownership, side, and geometry, and upserts by stable shared/color scope. The editor sends the scoped expectedVersion (null when absent), rejecting stale saves transactionally. Legacy API callers omitting expectedVersion retain last-save-wins behavior. Geometry does not change order variant identity or price, and preview refresh preserves unsaved order quantities.

## Shared composition

`CompositeSpec` holds blank URL or sample cut/color, artwork URL or null, side, and effective placement. `ShirtComposite.tsx` is the only renderer; `composite.ts` supplies deterministic geometry. Blank resolution is selected style/color/side, then shared style/side, then sample shape. Placement resolution is selected style/set/color/side, then shared style/set/side, then `(50,47.7,25,0)`.

The normalized canvas is 320 × 310. Blank images contain within the full canvas. Artwork contains within an 80 × 136 box centered at `(160,148)` before transformation. Transform is `translate(x*3.2,y*3.1) rotate(rotation) scale(width*3.2/80) translate(-160,-148)`. Numeric geometry uses the spec's ranges. Transparent PNG padding remains part of image fitting. Back composition never borrows the front PNG.

Uploads receive new immutable asset IDs. JSON/image requests do not cache stale results; changed catalog/set/style revisions reload current CompositeSpec. Member cards/bags and the editor reuse this renderer. Same-window events, same-origin BroadcastChannel notifications, and focus/visibility revalidation refresh authenticated composite data after upload/placement changes. The `sfbb:catalog-change` removed-set event uses an empty styleId to mean that the removal applies across the selected season; cart consumers must filter by removed set IDs across styles.

## Explicit cleanup

Run `npm run db:cleanup` with private DATA_DIR/DATABASE_URL for a dry run. It reports unreferenced metadata/file IDs and changes nothing. For deletion, stop the app and run `npm run db:cleanup -- --apply --app-stopped`. The migration Docker target contains the same script, so an operator can run a one-off private maintenance container against the mounted data volume after stopping the web container. Never run applying cleanup alongside uploads or another app process.

Cleanup uses a 24-hour grace period for asset metadata and orphan/pending files. It rechecks all front/back/blank references inside an SQLite write transaction, preserves shared/copied assets and recent unattached uploads, and only unlinks safe regular files within the assets directory. Used assets cannot be deleted through foreign-key restrictions. Backups must include both SQLite and the assets directory (Stage 12).

## Verification

Real-file/real-DB tests cover content validation, size/pixel limits, PNG transparency, atomic failure, storage confinement, side/color/style isolation, shared assets through season copying/deletion, placement precedence, set protections, and confirmed replacement identity. The cleanup CLI test covers dry-run behavior, explicit offline apply, shared references, and recent upload retention. Browser coverage uploads both sides and a blank photo, checks actual preview image elements after reload, and creates/deletes an extra set in an isolated season. The production ARM64 smoke passed authenticated PNG/alpha reads, malformed-upload rejection, session/image persistence after an actual container restart, and maintenance-command packaging. Its credentials, container, and volume were disposable and removed afterward.
