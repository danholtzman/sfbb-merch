# Operator handoff and release gate

The application implements the SFBB ordering design under `web/`; root HTML mockups remain the reference. Use [DEPLOYMENT.md](DEPLOYMENT.md) for manual releases and [BACKUP-RESTORE.md](BACKUP-RESTORE.md) for paired data recovery. No live Pi deployment, Caddy/tunnel change, GitHub push, or merge is performed by the local checks.

## First real season

1. Prepare the Pi root/data ownership and private `.env`. Generate independent `user`/`admin` password hashes with `web/scripts/hash-password.mjs`; generate a random 64+ character session secret. Keep plaintext shared passwords out of source, shell arguments, and public logs. There are two shared accounts and no registration.
2. The official SFBB logo has not been provided. Until then `web/src/components/Brand.tsx` uses an identifiable monogram placeholder. When supplied, put the trusted logo under `web/public/`, replace that mark with the supplied image and suitable alt text/sizing, and rebuild. The runtime image copies public assets. Do not substitute invented official artwork or stall testing on the missing asset.
3. Sign in as admin. The first authenticated admin render explicitly creates the initial draft/template setup once; builds and health requests do not seed demo orders. Open **Seasons → New season** or manage the initial draft. Enter name, inclusive Los Angeles opening/closing dates and announcement. Copying a prior collection copies definitions/photos; artwork reuse is an explicit choice. Seasons cannot have overlapping published windows.
4. Under **Merchandise**, add/manage shirt styles, prices, colors/sizes and offered artwork sets. New seasons begin with one paired set. Upload **Front** and **Back** PNGs in **Manage artwork**. Upload only unprinted front/back blank PNG/JPEG shirt photos in **Manage style**. Blanks are optional; the sample shape/color is the fallback.
5. Click a front/back preview or blue Edit link to position its artwork. Save shared placement for all colors or an explicit color override. Set/side/style/scope are independent. Changing editor target discards the unsaved draft; save before switching if you want to retain it.
6. Use **Preview shop** to inspect both sides, variants and bag layout. Preview checkout is disabled. Publish only after every offered set has both valid PNG sides and catalog/readiness checks pass. Unassigned extra sets do not block publication. Actual member orders are accepted only during the published season's inclusive Los Angeles window.
7. Share the member credential through the band's chosen private channel. Members add variants and positive integer quantities to a bag, enter full name/optional note, and get a six-character lookup code and amount owed at checkout. No email or online payment is needed.

Deletion protections include cancelled orders: a season/style/color/set used by any order is protected. Keep at least one color and set. Artwork-set deletion names the remaining replacement for sole-set styles. Preserve historical order prices/colors even when current catalog definitions change.

## Saves and order handling

Price changes, offered-set checkboxes, uploads, and order-status dropdowns save immediately. Color-row edits/removals apply together with **Save colors**. Season settings, new styles, placement geometry and order editors require their explicit save/create action. Closing/discarding those drafts does not apply changes. Modals support keyboard focus, Escape, and deliberate curtain clicks; a drag ending on the curtain does not dismiss them.

Members can edit/cancel/restore only while the published window is open and retained progress is Open. Admins can correct/edit/cancel/restore after closure and for other progress states. Cancelled orders retain their snapshots and prior progress. Status is **Open**, **Delivered · unpaid**, **Complete**, or a Cancelled badge. Complete/Cancelled amount owed is zero; partial-payment accounting was not designed.

The Orders dashboard selects a season, searches member/code, and opens direct admin editors. Search only changes the displayed table; downloads still include the entire selected season. Export **Billing CSV** for one active row per order, **Member delivery CSV** for variants grouped by member/order, and **Manufacturer order CSV** for aggregate variant quantities. All exclude cancelled orders and omit Season/Status columns. Season/date identity is in filenames. Delivered/Complete orders remain in delivery/manufacturer totals; Complete billing amount owed is zero. Fulfill and collect payment through the band's existing process, then update status.

## Manual Pi preparation and acceptance

The actual Pi's OS version, SSH destination, existing Caddyfile/tunnel paths and trusted-ingress headers remain operator inputs. Inspect the existing configuration before changing routing; do not paste unredacted tunnel tokens or private env values into a chat/log. The approved live route stays Cloudflare Tunnel → existing OS Caddy → loopback app port 3000. Caddy's TLS/listen choices must be preserved and validated, not replaced with a guessed new service.

Before approving the live release, run an **isolated** rehearsal on the Pi. Supply the verified release archive/checksum/manifest and matching checkout/scripts manually. Use a unique Compose project and disposable data/env; never restore over real member orders. You need Node 24/npm 11.19.0 for the test checkout, Python 3 and Docker/Compose as documented.

```sh
# In the matching source checkout on the Pi; replace the two example values.
# Keep port 3000 free for this test; do not stop an unrelated application.
export SFBB_SMOKE_TAG='replace-with-verified-commit-tag'
export SFBB_RELEASE_ARCHIVE='/absolute/path/to/sfbb-merch-TAG.tar'
export SFBB_SMOKE_MANIFEST="$SFBB_RELEASE_ARCHIVE.manifest.json"
python3 scripts/lib/release.py verify "$SFBB_RELEASE_ARCHIVE" "$SFBB_SMOKE_TAG"
docker load --input "$SFBB_RELEASE_ARCHIVE"
python3 scripts/lib/release.py images "$SFBB_SMOKE_MANIFEST"
# Install the pinned checkout dependencies on the Pi with Node 24/npm 11.19.0.
npm --prefix web ci
SFBB_CONTAINER_SMOKE=1 SFBB_BACKUP_SMOKE=1 SFBB_FIRST_INSTALL_SMOKE=1 \
  npm --prefix web test -- tests/integration/container-smoke.test.ts tests/integration/first-install.test.ts
```

This test creates a unique project/private temporary root, migrates, checks architecture/UID/root/storage, uploads an authenticated PNG, checks restart, then performs a verified backup and explicit restore of its own data. It checks incorrect release/overwrite, read-only staging failure, cold image loading and actual Prisma migration failure with the app left stopped. It removes its test containers/data afterwards. Capture the result; a local Mac Docker result does not substitute for the Pi/microSD rehearsal.

The verification suite now expects **4 passing tests**, including a Linux UID-permission regression. Retained databases are inspected through a read-only, network-disabled maintenance container because their mode-700 directories belong to UID 10001. Do not change storage ownership or run the entire suite as root to work around a host-side read failure. The test-only correction does not require rebuilding the `872cf8bd454a` application images.

After separate approval of the concrete release and Caddy/tunnel integration, deploy following DEPLOYMENT.md. Use an isolated setup season to check through `https://sfbb.holtzman.io`:

- Both shared logins work; no signup or payment fields appear. Production cookies are Secure/HttpOnly/SameSite and mutations use the exact public origin.
- Member shop/find-order work at desktop, 390px and 320px; front/back artwork, single-set controls, quantities, bag/checkout/code/owed amount and permitted edits work.
- Unauthorized `/admin` redirects to login; unauthenticated admin APIs/CSV downloads return 401; members cannot mutate admin resources or read draft catalog/compositions.
- Paired artwork/blank uploads and placement edits survive restart and do not swap front/back, sets or colors. Authenticated image URLs work through the domain.
- Admin corrections and all three CSV files match setup orders, including cancellation exclusion, Complete-zero billing, variant aggregation and season filenames.
- Docker's published binding is `127.0.0.1:3000`; inspect Pi listeners to confirm it is not publicly bound. Validate the actual Caddyfile before reload, verify the existing tunnel route, and inspect the address-trust setup. Leave proxy trust disabled unless Caddy overwrites both trust headers from validated ingress.
- Run and independently verify a manual backup, copy it off the microSD, and rehearse recovery using isolated data/compatible images. Confirm order/asset persistence and old-data retention before clearing test artifacts.

Record who ran the checks, date, source commit/image IDs, Pi architecture/OS, and results. No application script edits Caddy, creates a tunnel, guesses an SSH destination or publishes the site for you.

## Updates and recovery

Commit approved source, run the Mac release builder, retain the archive/sidecars, and transfer matching deployment/scripts manually. Deploy takes a verified stopped-app backup before migration and waits for health. Keep previous images, matching backups and release manifests. If migration fails, leave the app stopped and restore the paired backup with its exact compatible release. If current data cannot pass backup validation, explicitly use the documented quarantine recovery flag to retain that failed state; never start an older image against a changed database.

Check free space/logs and take backups before changes. Runtime logs rotate, but uploads/backups/previous data require deliberate operator retention/cleanup. `npm run db:cleanup` is dry-run by default; applying orphan cleanup requires stopping the app and explicit flags, as documented in ARTWORK.md. It is not a backup substitute. Never prune the only verified release/data recovery set.

## Local evidence and remaining gates

The committed plan's coverage map links spec sections 1–15 to tests/services. Local acceptance includes strict types/lint, backend invariants, all browser flows, desktop/390px/320px visual checks, production ARM64 builds and real container backup/restore failure rehearsal. A final independent whole-branch review checks concurrency, historical variants, Los Angeles windows/DST, asset boundaries and recoverability.

Actual Pi/microSD testing, official-logo supply, existing Caddy/tunnel inspection, live HTTPS acceptance, source integration/push and publication are distinct remaining operator gates. Do not label them passed merely because local checks are green. The live release requires explicit authorization after its concrete image/archive and runbook are reviewable.
