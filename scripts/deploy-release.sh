#!/usr/bin/env bash
set -euo pipefail
umask 077
sfbb_scripts=$(cd "$(dirname "$0")" && pwd)
source "$sfbb_scripts/lib/runtime.sh"
[[ $# -eq 2 ]] || sfbb_die 'Usage: scripts/deploy-release.sh <archive-path> <commit-prefix>'
sfbb_tag "$2"
sfbb_need python3; sfbb_need docker
[[ $(uname -m) == aarch64 || $(uname -m) == arm64 ]] || sfbb_die 'Deployment requires a 64-bit ARM host.'
export SFBB_ROOT=${SFBB_ROOT:-/srv/sfbb-merch}
[[ "$SFBB_ROOT" == /* ]] || sfbb_die 'SFBB_ROOT must be absolute.'
export SFBB_RELEASE_TAG=$2
sfbb_manifest="$1.manifest.json"
python3 "$sfbb_scripts/lib/release.py" verify "$1" "$2"
[[ -x "$SFBB_ROOT/scripts/backup.sh" ]] || sfbb_die 'Install and verify Stage 12 backup scripts before deployment.'
[[ -f "$SFBB_ROOT/deploy/compose.yaml" && -d "$SFBB_ROOT/data" ]] || sfbb_die 'Install deployment files and prepare the private data directory first.'
sfbb_private_env
# A single deployment/backup/restore may operate on this data directory at once.
sfbb_lock="$SFBB_ROOT/.operation-lock"
mkdir "$sfbb_lock" 2>/dev/null || sfbb_die 'Another operation is running; inspect .operation-lock before retrying.'
trap 'rmdir "$sfbb_lock"' EXIT
# Stop before taking the backup so no write can slip between backup and migration.
# Stage 12 backup detects an already stopped app and leaves it stopped.
sfbb_compose stop app
SFBB_OPERATION_LOCK_HELD=1 "$SFBB_ROOT/scripts/backup.sh" "$SFBB_ROOT/backups"
docker load --input "$1"
python3 "$sfbb_scripts/lib/release.py" images "$sfbb_manifest"
if ! sfbb_compose run --rm --no-deps migrate; then
  sfbb_die 'Migration failed; app remains stopped. Retain the backup and previous release. Follow BACKUP-RESTORE.md; never start an older image against the changed database.'
fi
if ! sfbb_compose up -d --no-deps --wait --wait-timeout 90 app; then
  sfbb_compose stop app || true
  sfbb_die 'Health check failed; app is stopped. Inspect private container logs and follow BACKUP-RESTORE.md. No automatic rollback was attempted.'
fi
cp "$sfbb_manifest" "$SFBB_ROOT/active-release.json.pending"
mv "$SFBB_ROOT/active-release.json.pending" "$SFBB_ROOT/active-release.json"
printf 'Release %s is healthy on the loopback listener. Complete the HTTPS domain acceptance checks.\n' "$2"
