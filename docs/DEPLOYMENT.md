# Manual ARM64 deployment

Stage 11 packages releases for the Raspberry Pi 5 (8 GB, 64-bit OS, microSD). Caddy and Cloudflare Tunnel keep running on the Pi's OS. The app is one Linux ARM64 Node 24 container, SQLite and uploaded images live together in `/srv/sfbb-merch/data`, and source lives on GitHub. Builds and transfers are manual; no registry, CI, paid service, or scheduled deployment is required. Nothing in this stage has changed the Pi, Caddy, tunnel, or live domain.

Backup/restore scripts are documented in [BACKUP-RESTORE.md](BACKUP-RESTORE.md), and the release gate is in [OPERATIONS.md](OPERATIONS.md). Do not deploy until the concrete release and existing Caddy/tunnel configuration are approved. `deploy-release.sh` refuses without the backup script. The tests in this stage use only temporary local data and containers.

## Operator prerequisites

On the Apple Silicon Mac: Git, Python 3, Docker Desktop with Buildx, and enough free space for two images and an uncompressed image archive. Use Node 24/npm 11.19.0 for native checks. On the Pi: 64-bit Linux (`uname -m` reports aarch64/arm64), Python 3, Docker Engine and Docker Compose 2.30+ (needed for raw env files), and an operator account permitted to use Docker. Do not install another Caddy or tunnel container.

Docker/Compose behavior is described in the official [service reference](https://docs.docker.com/reference/compose-file/services/), [image save reference](https://docs.docker.com/reference/cli/docker/image/save/), and [health-wait startup reference](https://docs.docker.com/reference/cli/docker/compose/up/). The Compose file uses loaded images with `pull_policy: never`; deployment does not download a differently tagged release.

Prepare `/srv/sfbb-merch` as an operator-controlled directory. Install the matching `deploy/` and `scripts/` directories there, including `scripts/lib/`. Keep all release archives, sidecars, previous manifests, and verified backups until they are no longer needed for rollback. The app must be the only process writing this SQLite database; do not scale replicas or run multiple copies against the data directory.

```sh
# Run on the Pi as the actual operator; substitute your account/group.
sudo install -d -m 750 -o "$USER" -g "$(id -gn)" /srv/sfbb-merch
sudo install -d -m 700 -o 10001 -g 10001 /srv/sfbb-merch/data
mkdir -p /srv/sfbb-merch/releases /srv/sfbb-merch/backups
cp /srv/sfbb-merch/deploy/.env.example /srv/sfbb-merch/.env
chmod 600 /srv/sfbb-merch/.env
```

The operator prepares ownership; deployment scripts do not run sudo or guess a username. Existing/restored data and `assets/` must also be owned by UID/GID 10001. Do not chown unrelated directories. Root runtime is read-only, `/tmp` is a bounded temporary filesystem, all capabilities are dropped, and the app runs as UID/GID 10001. Docker logs rotate at 3 × 10 MB to limit microSD use. Database/asset capacity and free space remain operator responsibilities.

Generate two independent credential hashes with `web/scripts/hash-password.mjs` as described in [AUTHENTICATION.md](AUTHENTICATION.md). Put them, a random session secret of at least 64 characters, and the session lifetime in the private `.env`. Use a secret manager or private editor; do not pass shared passwords as shell arguments. There are only `user` and `admin` accounts and no account creation. Compose uses raw env-file values so `$` characters cannot trigger interpolation. Compose fixes `NODE_ENV=production`, `PUBLIC_ORIGIN=https://sfbb.holtzman.io`, `DATA_DIR=/data`, and `DATABASE_URL=file:/data/sfbb.sqlite`; the secrets file cannot redirect storage or origin.

## Build on the Mac

Commit the approved source first. `scripts/build-release.sh <release-tag>` accepts only a 7–40 character lowercase Git commit prefix matching HEAD and refuses dirty source or an existing output directory. No working checkout, credentials, databases, or Mac native modules are copied into the archive. The image contains the application, so protect release files accordingly even though secrets are not included.

```sh
release_tag=$(git rev-parse --short=12 HEAD)
scripts/build-release.sh "$release_tag"
```

Default output: `releases/<tag>/sfbb-merch-<tag>.tar`, `.tar.sha256`, and `.tar.manifest.json` (ignored by Git). `RELEASE_OUTPUT_DIR` can select another **new** output directory. Each target is built with `docker buildx build --platform linux/arm64 --load`, tagged `sfbb-merch:<tag>` and `sfbb-merch-migrate:<tag>`, and labelled with the full source commit. Docker save includes the matching pair in one archive. Migration tooling stays in the maintenance image; the web runtime omits Prisma CLI and test/lint tooling.

The manifest records format version, commit/tag, Linux ARM64 platform, actual Node 24 version, both image names/content IDs, archive SHA-256 and schema migration directory names. Verification streams the archive checksum and compares loaded image IDs, platform, and commit labels. SHA-256 detects accidental corruption; it is not a signature. Transfer the archive, checksum, and manifest together through your trusted SSH connection.

```sh
# Substitute your actual SSH destination; no server address is assumed.
scp releases/"$release_tag"/sfbb-merch-"$release_tag".tar* "$PI_SSH_DEST:/srv/sfbb-merch/releases/"
scp -r deploy scripts "$PI_SSH_DEST:/srv/sfbb-merch/"
```

Transfer deployment/scripts from the exact same commit as the images. Do not copy the Mac's secrets, SQLite database, or `node_modules`. Copy all scripts, including backup/restore helpers, before first deployment.

## Deploy on the Pi, after Stage 12 and approval

```sh
/srv/sfbb-merch/scripts/deploy-release.sh \
  /srv/sfbb-merch/releases/sfbb-merch-<tag>.tar <tag>
```

`SFBB_ROOT` can point to a different absolute private root for isolated rehearsals, but you must also set a distinct `SFBB_COMPOSE_PROJECT` so tests cannot stop another deployment. Its layout and Compose file are otherwise identical. Neither scripts nor Compose contains SSH destinations or production passwords.

The script validates tag, manifest, archive checksum, private env permissions, prepared data directory and backup availability before stopping anything. It holds `.operation-lock` to prevent concurrent deployment/backup/restore. On first installation, it first loads/verifies the candidate image pair so the maintenance image can capture an empty-data marker; loading images changes neither data nor listeners. For upgrades it uses the existing active maintenance image for backup before loading the candidate. It stops the existing app, invokes the verified Stage 12 backup with the app already stopped (so no writes happen after the backup), loads the archive, validates both loaded image identities/commit/platform, runs the matching one-shot migration, starts the app and waits up to 90 seconds for Docker health. The migration service has no port/listener and is explicitly invoked with `run --rm --no-deps migrate`. Only a healthy startup promotes `active-release.json` atomically. Old archives/images/backups are never pruned automatically.

Task 12 backup must use the existing active release's manifest, recognize an already stopped app and leave it stopped, and honor `SFBB_OPERATION_LOCK_HELD=1` when called by this locked deployment. First-install backup handles an empty data directory without inventing an existing release/database. The deployment script does not invoke a live release in Stage 11.

If any step after stopping fails, the app stays stopped; inspect the error and preserve the last verified backup. Migration failure explicitly prohibits starting an old image against a possibly changed schema. Health failure also stops the new app. Recover with the paired database/assets backup and its compatible release following Stage 12's BACKUP-RESTORE runbook. An image-only rollback is not a schema rollback. If an operation was interrupted, inspect running containers and data before removing a stale `.operation-lock`; do not blindly remove it while another operation is active.

The health endpoint checks process liveness, not storage integrity. Migration validation, the real container smoke, and the domain acceptance below establish the stronger checks.

## Existing Caddy and Cloudflare Tunnel

`deploy/Caddyfile.example` is an **additive reference**, never an installer. Before applying anything, inspect the existing Caddyfile/site, service environment, listen address, TLS policy, and cloudflared ingress route. Preserve the existing tunnel-to-Caddy route and certificate choices. The tunnel must route to existing Caddy, which reverse proxies to `127.0.0.1:3000`; do not route a publicly exposed Docker listener or replace the tunnel configuration. The app's only published port is `127.0.0.1:3000:3000`.

Merge the reverse-proxy stanza into the actual site. Adapt the site address/TLS settings to the existing deployment; blindly adding a hostname block may change automatic HTTPS behavior. Use `caddy validate --config <actual-config>` before a deliberate Caddy reload. No Caddy command runs from release scripts. See Caddy's [reverse proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

Default proxy behavior strips incoming `X-SFBB-Proxy-Secret` and `X-SFBB-Client-IP`; leave `TRUSTED_PROXY_SECRET` empty. The app ignores arbitrary X-Forwarded-For/CF-Connecting-IP headers and uses a conservative shared untrusted address bucket. To support per-client throttling, first establish that the request arrived through the trusted tunnel ingress and validate a numeric client address. Then configure Caddy to **overwrite**, rather than forward, both `X-SFBB-Proxy-Secret` with a separate random 64+ character shared secret and `X-SFBB-Client-IP` with that validated numeric address. Configure the same private secret in the app. Do not trust a client-supplied Cloudflare header on an accessible ingress. The exact trusted-ingress/header mapping remains an environment-specific inspection item; this repository cannot infer it.

## Local and Pi checks

The opt-in smoke uses only a temporary private env/data directory and a uniquely named Compose project. It binds the actual loopback port 3000, so stop any conflicting **test** listener first; do not interrupt another application just to run it. It migrates using the maintenance image, checks effective Compose config and container architecture/UID/read-only root, writes and reads SQLite, exercises Sharp via a real authenticated PNG upload, verifies asset/session/database persistence across restart, and checks private loopback health. It removes its own containers and temporary data afterward.

```sh
# First build matching local smoke images from the current source.
docker buildx build --platform linux/arm64 --load --target runtime -t sfbb-merch:stage11-smoke web/
docker buildx build --platform linux/arm64 --load --target migration -t sfbb-merch-migrate:stage11-smoke web/
SFBB_CONTAINER_SMOKE=1 npm --prefix web test -- tests/integration/container-smoke.test.ts
```

Set `SFBB_SMOKE_TAG` to a loaded verified release tag to smoke that pair. Run this check on the actual Pi at execution time using a separate checkout/test root; do not run it against real member data. The default backend suite skips Docker smoke so it remains runnable without a daemon. Shell deployment tests run against fake Docker in disposable directories, including failed migration and no-start behavior; they never touch `/srv/sfbb-merch` or the Pi.

Stage 12's approved domain acceptance must verify HTTPS login/shop/find-order/admin, authenticated PNG delivery/front/back composition, cookie/origin enforcement, unauthenticated admin/export rejection, exact CSV downloads, restart persistence and a verified restore. Inspect Docker port bindings and Pi listeners to confirm port 3000 is loopback-only. Use isolated setup data for order/cancel/restore tests; never destructive tests on real orders. Record what passes locally versus what still requires the real Pi and existing ingress configuration.
