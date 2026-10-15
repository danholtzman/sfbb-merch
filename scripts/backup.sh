#!/usr/bin/env bash
set -euo pipefail
umask 077
sfbb_scripts=$(cd "$(dirname "$0")" && pwd)
source "$sfbb_scripts/lib/runtime.sh"
[[ $# -eq 1 ]] || sfbb_die 'Usage: scripts/backup.sh <output-directory>'
sfbb_init; sfbb_use_active_release
mkdir -p "$1"
sfbb_output=$(cd "$1" && pwd)
[[ "$sfbb_output" != "$SFBB_ROOT/data" && "$sfbb_output" != "$SFBB_ROOT/data/"* ]] || sfbb_die 'Backup output must be outside the data directory.'
sfbb_nonce=$(python3 -c 'import datetime,uuid;print(datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")+"-"+uuid.uuid4().hex)')
sfbb_archive="$sfbb_output/sfbb-backup-$sfbb_nonce.tar.gz"
sfbb_partial="$sfbb_archive.pending"
sfbb_running=0; sfbb_safe_restart=0
sfbb_lock_acquire
sfbb_cleanup() {
  sfbb_result=$?
  trap - EXIT
  rm -f "$sfbb_partial" "$sfbb_partial.sha256" "$sfbb_archive.manifest.json.pending"
  if [[ "$sfbb_running" == 1 && "$sfbb_safe_restart" == 1 ]]; then
    if ! sfbb_compose up -d --no-deps --wait --wait-timeout 90 app; then
      printf 'sfbb: Backup retained, but original app did not restart; inspect private logs.\n' >&2
      sfbb_result=1
    fi
  elif [[ "$sfbb_running" == 1 && "$sfbb_result" != 0 ]]; then
    printf 'sfbb: App remains stopped because data/release validation failed. Inspect before restarting.\n' >&2
  fi
  sfbb_lock_release
  exit "$sfbb_result"
}
trap sfbb_cleanup EXIT
sfbb_release=none
sfbb_volumes=(--volume "$sfbb_scripts/lib:/ops:ro")
if [[ -f "$SFBB_ROOT/active-release.json" ]]; then
  python3 "$sfbb_scripts/lib/release.py" images "$SFBB_ROOT/active-release.json"
  sfbb_release=env
  # Release metadata is public; avoid making the private operator-owned file readable by UID 10001.
  sfbb_volumes+=(--env "SFBB_BACKUP_RELEASE_JSON=$(cat "$SFBB_ROOT/active-release.json")")
fi
[[ -z $(sfbb_compose ps --status running -q app) ]] || sfbb_running=1
sfbb_compose stop app
sfbb_compose run --rm --no-deps -T --entrypoint python3 "${sfbb_volumes[@]}" migrate /ops/backup.py inspect /data "$sfbb_release" >&2
sfbb_safe_restart=1
sfbb_compose run --rm --no-deps -T --entrypoint python3 "${sfbb_volumes[@]}" migrate /ops/backup.py create /data "$sfbb_release" > "$sfbb_partial"
python3 "$sfbb_scripts/lib/backup.py" checksum "$sfbb_partial"
python3 "$sfbb_scripts/lib/backup.py" verify "$sfbb_partial" > "$sfbb_archive.manifest.json.pending"
python3 "$sfbb_scripts/lib/backup.py" promote "$sfbb_partial" "$sfbb_archive"
python3 "$sfbb_scripts/lib/backup.py" checksum "$sfbb_archive"
mv "$sfbb_archive.manifest.json.pending" "$sfbb_archive.manifest.json"
printf 'Verified backup: %s\nKeep all sidecars and copy this backup off the microSD card.\n' "$sfbb_archive"
