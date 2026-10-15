#!/usr/bin/env bash
set -euo pipefail
sfbb_scripts=$(cd "$(dirname "$0")" && pwd)
source "$sfbb_scripts/lib/runtime.sh"
[[ $# -eq 1 ]] || sfbb_die 'Usage: scripts/verify-backup.sh <archive.tar.gz>'
sfbb_need python3
python3 "$sfbb_scripts/lib/backup.py" verify "$1" >/dev/null
printf 'Backup verified: archive checksum, safe paths, SQLite integrity, migration identity, and referenced assets.\n'
