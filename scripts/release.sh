#!/bin/bash
# Publishes the current build to the `release` branch, which installed updaters pull hourly.
# Bump the version in static/manifest.json first: updaters only act on a new version.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
VERSION="$(grep -o '"version"[^,]*' dist/manifest.json | sed 's/.*"\([^"]*\)"$/\1/')"
WORK="$(mktemp -d)"
trap 'git worktree remove --force "$WORK" 2>/dev/null || true' EXIT
if git ls-remote --exit-code --heads origin release >/dev/null 2>&1; then
  git fetch -q origin release
  git worktree add -q "$WORK" origin/release
else
  git worktree add -q --detach "$WORK"
  git -C "$WORK" checkout -q --orphan release
fi
git -C "$WORK" rm -rq . 2>/dev/null || true
mkdir -p "$WORK/extension"
cp -R dist/. "$WORK/extension/"
cp scripts/mac/install.sh scripts/mac/update.sh scripts/mac/uninstall.sh "$WORK/"
printf '# Trip Radar release\n\nBuilt extension (`extension/`) and the macOS updater. Source is on `main`.\n' > "$WORK/README.md"
git -C "$WORK" add -A
git -C "$WORK" commit -q -m "Release $VERSION" || { echo "nothing to release"; exit 0; }
git -C "$WORK" push -q origin HEAD:release
echo "released $VERSION"
