#!/usr/bin/env bash
# Shared helpers; no side effects when sourced.
sfbb_die() { printf 'sfbb: %s\n' "$*" >&2; exit 1; }
sfbb_need() { command -v "$1" >/dev/null 2>&1 || sfbb_die "Install $1 before continuing."; }
sfbb_tag() { [[ "$1" =~ ^[a-f0-9]{7,40}$ ]] || sfbb_die 'Release tag must be a 7–40 character Git commit prefix.'; }
sfbb_compose() { docker compose --project-name sfbb-merch --file "$SFBB_ROOT/deploy/compose.yaml" "$@"; }
sfbb_private_env() {
  python3 - "$SFBB_ROOT/.env" <<'PY'
import os,stat,sys
p=sys.argv[1]
if not os.path.isfile(p) or os.path.islink(p) or stat.S_IMODE(os.stat(p).st_mode)&0o077:
    sys.exit('sfbb: Private .env is missing or readable by another user; use chmod 600.')
PY
}
