#!/usr/bin/env bash
set -euo pipefail

deploy_root="${PEPSA_STATIC_ROOT:-${HOME}/var/www/admin}"
cd "$deploy_root"

test -d .git || {
  echo "ERROR: $deploy_root is not a git clone. Clone the admin frontend repo there first." >&2
  exit 1
}

export PATH="/usr/local/bin:/usr/bin:/bin:${HOME}/.local/bin:${PATH}"
[[ -s "${HOME}/.nvm/nvm.sh" ]] && source "${HOME}/.nvm/nvm.sh"

export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=1536}"
pnpm install --frozen-lockfile
pnpm build

echo "Admin frontend built at $(git rev-parse --short HEAD) → $deploy_root/dist"
