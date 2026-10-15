# Manual backup and restore

Back up SQLite and its paired artwork files together. GitHub source and release images are not a data backup. The scripts are manual; there is no scheduled backup or paid service. Keep the verified archive and both sidecars on another storage device or computer, not solely on the Pi's microSD. Preserve `/srv/sfbb-merch/.env` separately in an operator-controlled private location; backups deliberately exclude credentials/session secrets.

## What a backup contains

`scripts/backup.sh <output-directory>` captures the stopped app's `sfbb.sqlite`, any retained `-wal`, `-shm`, or `-journal` companions, and canonical files in `assets/`. It includes the active release manifest and a backup manifest listing each member's size/SHA-256. Temporary upload files, runtime caches, secrets, and source are excluded. Existing unreferenced canonical image files may be retained; all referenced front/back/blank assets must exist and match database hashes. An interrupted upload's pending file is not a referenced asset and is excluded.

Archive names include UTC time and a random suffix. The archive, `.sha256`, and `.manifest.json` sidecar are private operator-owned files (umask 077). Embedded manifests are authoritative; the archive checksum detects corruption, not a malicious replacement from an untrusted source. Backup contents include member names/notes/order codes, so treat them as private.

```sh
# On the Pi, after installing the matching deployment/scripts and private env:
/srv/sfbb-merch/scripts/backup.sh /srv/sfbb-merch/backups
/srv/sfbb-merch/scripts/verify-backup.sh /path/to/sfbb-backup-<timestamp>.tar.gz
# Transfer all three files manually to your private off-Pi destination.
```

Verification requires host Python 3 with its standard SQLite module, without Docker or application secrets. It checks SHA-256, rejects unsafe paths/links/duplicates, validates per-file hashes and SQLite integrity/foreign keys, requires the exact applied migration list from the recorded release, and verifies referenced image sizes/hashes. An older release paired with a newer database or an incomplete migration is rejected. A fresh installation with no database/release produces an explicit empty-install marker; it is verifiable but cannot restore an application database.

## Stopping, restart, and failures

The backup script uses the existing Compose file and active release image, holds `.operation-lock`, and stops app writes before capture. A non-root maintenance container reads UID 10001 data and streams the archive to a host-owned private file; the operator never needs permission to read the live data directly. Nonsecret release JSON is passed separately, so the private active-release file does not have to become readable by UID 10001.

After validating schema/assets, a standalone backup restarts the original app if it was running, including safe capture/verification failure cases. A backup invoked by deployment/restore receives the held lock and detects the already-stopped app; it leaves it stopped. If data/release validation fails, it does not restart an incompatible image. Failed capture/verification never promotes a partial archive over an older backup. Restart failure retains the verified backup and reports that the app is still stopped.

If interrupted by power loss or SIGKILL, the app may remain stopped and the lock or `.pending` files may remain. Do not treat partial files as backups. Inspect running maintenance containers and stop any incomplete operation before clearing a stale lock. Preserve the last verified backup; the capture helper does not mutate live application rows or artwork. Once the database/release association is verified, deliberately start the recorded compatible app and re-run backup. Never copy just the live SQLite main file while the app writes, especially when a WAL exists.

## Restore a verified backup

Load the **exact recorded** web and migration image pair first using its retained release archive/checksum/manifest. Install the matching scripts/configuration and restore the private `.env` separately. Use the same session secret if retained sessions are desired; rotating it deliberately signs everyone out. Do not run migrations during restore or guess compatibility from a filename/tag.

```sh
/srv/sfbb-merch/scripts/verify-backup.sh /path/to/backup.tar.gz
/srv/sfbb-merch/scripts/restore.sh /path/to/backup.tar.gz <recorded-release-tag>
# If existing data is present, the first call refuses without changing it.
# After reviewing the backup, explicitly authorize replacement:
/srv/sfbb-merch/scripts/restore.sh /path/to/backup.tar.gz <recorded-release-tag> --replace-existing
```

Prepare an empty data directory owned by UID/GID 10001 for a new installation. Restore validates archive, applied schema, and loaded image identity/commit/platform **before** stopping or replacing anything. For replacement, it stops the app and takes a verified pre-restore backup. It extracts into a new staging directory, validates again, and sets UID/GID 10001 ownership. Only this confined network-disabled maintenance helper runs as root with ownership capabilities; the application remains non-root and read-only.

The old directory is renamed to `.previous-data-<id>` and retained. The old release manifest is also retained, and the recorded backup release becomes active. Restore removes the stopped app container before renaming the directories, then creates a fresh container so its bind mount cannot keep pointing at the old directory. It starts the recorded image, waits for health, and tells you where the previous data remains. Complete order/asset/domain checks before deliberately removing previous data and staging metadata. There is no automatic rollback or deletion of previous archives/backups.

Disk use can temporarily include the old data, new staged data, compressed archive, and pre-restore backup. Check free microSD space first. A denied/full/read-only staging write aborts before swapping directories, retains existing data/verified backup, and leaves the app stopped with a clear error. A health failure after swapping leaves the restored app stopped and retains previous data and pre-restore backup.

If interrupted between directory renames, inspect `.previous-data-*`, `.restore-stage-*`, `active-release.json`, and the verified pre-restore backup. Do not start an image until its recorded manifest matches the selected data. Recover the whole paired data set through a verified backup and compatible image; an image-only rollback is insufficient. If the active manifest is inconsistent after a failed migration, use the pre-migration verified backup and its recorded manifest rather than attempting to capture/restart the older image against changed schema. Do not delete evidence or overwrite the previous verified backup while recovering.

For isolated rehearsal, use an alternate absolute `SFBB_ROOT` **and a distinct `SFBB_COMPOSE_PROJECT`**, a private test env, and disposable data. The scripts reject an alternate root without a separate project. This prevents a rehearsal from stopping production containers by project name. Use no real member data in destructive restore tests.

## Rehearsal and release status

Local tests cover a retained WAL, corruption/truncation, missing artwork, migration mismatch, constrained extraction, empty install, UID/metadata permissions, and actual non-root ARM64 container backup/restart/restore. The Docker rehearsal verifies unchanged backups survive a read-only staging failure, overwrite/wrong-release attempts are refused, old data/pre-backup remain, and SQLite/assets/session recover together. The same rehearsal must be run on the actual Pi before live release; see [OPERATIONS.md](OPERATIONS.md). Local success does not verify the microSD, existing Caddy/tunnel ingress, or domain route.
