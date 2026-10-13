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

# Build into a sibling dir, then rename into place so live dist/ is never
# emptyOutDir'd mid-deploy (nginx would SPA-fallback missing JS as text/html).
next_dist="$deploy_root/.dist-next-$$"
prev_dist="$deploy_root/.dist-prev-$$"
rm -rf "$next_dist" "$prev_dist"
export PEPSA_VITE_OUTDIR="$next_dist"
pnpm build
test -f "$next_dist/index.html"

if [[ -d "$deploy_root/dist" ]]; then
  mv "$deploy_root/dist" "$prev_dist"
fi
mv "$next_dist" "$deploy_root/dist"
rm -rf "$prev_dist"

echo "Admin frontend built at $(git rev-parse --short HEAD) → $deploy_root/dist"
