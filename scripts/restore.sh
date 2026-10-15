#!/usr/bin/env bash
set -euo pipefail
umask 077
sfbb_scripts=$(cd "$(dirname "$0")" && pwd)
source "$sfbb_scripts/lib/runtime.sh"
[[ $# -ge 2 && $# -le 4 ]] || sfbb_die 'Usage: scripts/restore.sh <archive.tar.gz> <recorded-release-tag> [--replace-existing] [--quarantine-unverified-current]'
sfbb_replace=0; sfbb_quarantine=0
for sfbb_option in "${@:3}"; do
  case "$sfbb_option" in
    --replace-existing) [[ "$sfbb_replace" == 0 ]] || sfbb_die 'Duplicate replacement flag'; sfbb_replace=1 ;;
    --quarantine-unverified-current) [[ "$sfbb_quarantine" == 0 ]] || sfbb_die 'Duplicate recovery flag'; sfbb_quarantine=1 ;;
    *) sfbb_die 'Unknown restore option' ;;
  esac
done
[[ "$sfbb_quarantine" == 0 || "$sfbb_replace" == 1 ]] || sfbb_die 'Recovery quarantine also requires --replace-existing.'
sfbb_tag "$2"; sfbb_init
sfbb_nonce=$(python3 -c 'import uuid;print(uuid.uuid4().hex[:12])')
sfbb_release_file="$SFBB_ROOT/.restore-release-$sfbb_nonce.json"
# All archive/schema/image checks happen before stopping or replacing anything.
python3 "$sfbb_scripts/lib/backup.py" release "$1" "$sfbb_release_file"
sfbb_recorded=$(python3 - "$sfbb_release_file" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))['releaseTag'])
PY
)
[[ "$2" == "$sfbb_recorded" ]] || { rm -f "$sfbb_release_file"; sfbb_die 'Restore release must exactly match the backup; never use an older image/newer schema.'; }
python3 "$sfbb_scripts/lib/release.py" images "$sfbb_release_file"
export SFBB_RELEASE_TAG=$sfbb_recorded
sfbb_lock_acquire
trap 'rm -f "$sfbb_release_file"; sfbb_lock_release' EXIT
sfbb_nonempty=$(sfbb_compose run --rm --no-deps -T --entrypoint python3 --volume "$sfbb_scripts/lib:/ops:ro" migrate /ops/backup.py nonempty /data)
if [[ "$sfbb_nonempty" == yes && $sfbb_replace != 1 ]]; then sfbb_die 'Existing data will not be overwritten. Use --replace-existing after reviewing this backup.'; fi
sfbb_compose stop app
if [[ "$sfbb_nonempty" == yes ]]; then
  if ! SFBB_OPERATION_LOCK_HELD=1 "$sfbb_scripts/backup.sh" "$SFBB_ROOT/backups"; then
    [[ "$sfbb_quarantine" == 1 ]] || sfbb_die 'Current data cannot produce a verified backup; app remains stopped. To recover the verified target while retaining failed data, explicitly add --quarantine-unverified-current with --replace-existing.'
    printf 'sfbb: Explicit recovery: current data is unverified and will be retained intact in .previous-data-* with its previous release metadata. It is not a verified backup.\n' >&2
  fi
fi
sfbb_stage="$SFBB_ROOT/.restore-stage-$sfbb_nonce"
mkdir "$sfbb_stage"
# This one-shot extraction helper runs as root to set data ownership.
# It has no network and can write only to the new staging directory.
if ! docker run --rm -i --read-only --network none --user 0:0 --cap-drop ALL --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER \
  --mount "type=bind,src=$sfbb_scripts/lib,dst=/ops,readonly" \
  --mount "type=bind,src=$sfbb_stage,dst=/restore" --entrypoint python3 \
  "sfbb-merch-migrate:$sfbb_recorded" /ops/backup.py extract /restore 10001 < "$1"; then
  sfbb_die "Restore staging failed; app remains stopped, existing data and backup are intact. Inspect $sfbb_stage."
fi
# Release the old bind mount before renaming its source. Stopping alone leaves
# the container/mount alive (notably with Docker Desktop file sharing).
sfbb_compose rm --force app
sfbb_previous="$SFBB_ROOT/.previous-data-$sfbb_nonce"
# Perform the rename in Docker's filesystem namespace too: host-side renames
# can leave Docker Desktop file-sharing lookups cached at the old inode.
docker run --rm --read-only --network none --user 0:0 --cap-drop ALL --cap-add DAC_OVERRIDE \
  --mount "type=bind,src=$SFBB_ROOT,dst=/state" --entrypoint python3 \
  "sfbb-merch-migrate:$sfbb_recorded" -c 'import os,sys; nonce=sys.argv[1]; os.rename("/state/data","/state/.previous-data-"+nonce); os.rename("/state/.restore-stage-"+nonce+"/data","/state/data")' "$sfbb_nonce"
if [[ -f "$SFBB_ROOT/active-release.json" ]]; then cp "$SFBB_ROOT/active-release.json" "$SFBB_ROOT/.previous-release-$sfbb_nonce.json"; fi
cp "$sfbb_release_file" "$SFBB_ROOT/active-release.json.pending"
mv "$SFBB_ROOT/active-release.json.pending" "$SFBB_ROOT/active-release.json"
# Force recreation: an existing container's bind mount can retain the old inode.
if ! sfbb_compose up -d --no-deps --force-recreate --wait --wait-timeout 90 app; then
  sfbb_compose stop app || true
  sfbb_die "Restored app failed health; it remains stopped. Previous data is retained at $sfbb_previous. No automatic rollback."
fi
printf 'Restore healthy for release %s. Previous data retained at %s. Complete domain/order/asset checks before deleting it.\n' "$sfbb_recorded" "$sfbb_previous"
