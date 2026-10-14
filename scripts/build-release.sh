#!/usr/bin/env bash
set -euo pipefail
umask 077
sfbb_source=$(cd "$(dirname "$0")/.." && pwd)
source "$sfbb_source/scripts/lib/runtime.sh"
[[ $# -eq 1 ]] || sfbb_die 'Usage: scripts/build-release.sh <commit-prefix>'
sfbb_tag "$1"
sfbb_need git; sfbb_need docker; sfbb_need python3
[[ -z $(git -C "$sfbb_source" status --porcelain) ]] || sfbb_die 'Commit changes first: release source must be clean.'
sfbb_commit=$(git -C "$sfbb_source" rev-parse HEAD)
[[ "$sfbb_commit" == "$1"* ]] || sfbb_die 'Release tag must identify the current Git commit.'
sfbb_out=${RELEASE_OUTPUT_DIR:-$sfbb_source/releases/$1}
[[ ! -e "$sfbb_out" ]] || sfbb_die 'Output directory already exists; retain previous releases and choose a new destination.'
mkdir -p "$sfbb_out"
sfbb_out=$(cd "$sfbb_out" && pwd)
sfbb_archive="$sfbb_out/sfbb-merch-$1.tar"
for sfbb_target in runtime migration; do
  sfbb_image="sfbb-merch:$1"
  [[ "$sfbb_target" != migration ]] || sfbb_image="sfbb-merch-migrate:$1"
  docker buildx build --platform linux/arm64 --load --target "$sfbb_target" --build-arg "RELEASE_COMMIT=$sfbb_commit" --tag "$sfbb_image" "$sfbb_source/web"
done
docker image save --output "$sfbb_archive.pending" "sfbb-merch:$1" "sfbb-merch-migrate:$1"
mv "$sfbb_archive.pending" "$sfbb_archive"
python3 "$sfbb_source/scripts/lib/release.py" create "$sfbb_archive" "$1" "$sfbb_commit" "$sfbb_source"
python3 "$sfbb_source/scripts/lib/release.py" images "$sfbb_archive.manifest.json"
printf 'Release archive: %s\nTransfer its .sha256/.manifest.json sidecars and matching deploy/ and scripts/ files manually.\n' "$sfbb_archive"
