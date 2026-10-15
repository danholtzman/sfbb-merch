#!/usr/bin/env bash
# Shared helpers; no side effects when sourced.
sfbb_die() { printf 'sfbb: %s\n' "$*" >&2; exit 1; }
sfbb_need() { command -v "$1" >/dev/null 2>&1 || sfbb_die "Install $1 before continuing."; }
sfbb_tag() { [[ "$1" =~ ^[a-f0-9]{7,40}$ ]] || sfbb_die 'Release tag must be a 7–40 character Git commit prefix.'; }
sfbb_compose() { docker compose --project-name "${SFBB_COMPOSE_PROJECT:-sfbb-merch}" --file "$SFBB_ROOT/deploy/compose.yaml" "$@"; }
sfbb_private_env() {
  python3 - "$SFBB_ROOT/.env" <<'PY'
import os,stat,sys
p=sys.argv[1]
if not os.path.isfile(p) or os.path.islink(p) or stat.S_IMODE(os.stat(p).st_mode)&0o077:
    sys.exit('sfbb: Private .env is missing or readable by another user; use chmod 600.')
PY
}
sfbb_init() {
  export SFBB_ROOT=${SFBB_ROOT:-/srv/sfbb-merch}
  [[ "$SFBB_ROOT" == /* && ! -L "$SFBB_ROOT" && ! -L "$SFBB_ROOT/data" ]] || sfbb_die 'SFBB_ROOT/data must be an absolute real directory.'
  if [[ "$SFBB_ROOT" != /srv/sfbb-merch && -z ${SFBB_COMPOSE_PROJECT:-} ]]; then
    sfbb_die 'Set a distinct SFBB_COMPOSE_PROJECT for an alternate SFBB_ROOT; do not stop another deployment.'
  fi
  export SFBB_COMPOSE_PROJECT=${SFBB_COMPOSE_PROJECT:-sfbb-merch}
  [[ "$SFBB_COMPOSE_PROJECT" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || sfbb_die 'Invalid Compose project name.'
  sfbb_need python3; sfbb_need docker
  [[ -d "$SFBB_ROOT/data" && -f "$SFBB_ROOT/deploy/compose.yaml" ]] || sfbb_die 'Prepare data and deployment files first.'
  sfbb_private_env
}
sfbb_use_active_release() {
  if [[ -f "$SFBB_ROOT/active-release.json" ]]; then
    SFBB_RELEASE_TAG=$(python3 - "$SFBB_ROOT/active-release.json" <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))['releaseTag'])
PY
)
  fi
  [[ -n ${SFBB_RELEASE_TAG:-} ]] || sfbb_die 'No active release; supply the verified candidate SFBB_RELEASE_TAG for first-install backup.'
  sfbb_tag "$SFBB_RELEASE_TAG"; export SFBB_RELEASE_TAG
}
sfbb_lock_acquire() {
  sfbb_lock="$SFBB_ROOT/.operation-lock"; sfbb_owns_lock=0
  if [[ ${SFBB_OPERATION_LOCK_HELD:-} == 1 ]]; then
    [[ -d "$sfbb_lock" && ! -L "$sfbb_lock" ]] || sfbb_die 'Operation lock handoff is invalid.'
  else
    mkdir "$sfbb_lock" 2>/dev/null || sfbb_die 'Another operation is running; inspect .operation-lock before retrying.'
    sfbb_owns_lock=1
  fi
}
sfbb_lock_release() { if [[ ${sfbb_owns_lock:-0} == 1 ]]; then rmdir "$sfbb_lock"; fi; }
