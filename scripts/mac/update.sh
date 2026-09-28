#!/bin/bash
# Trip Radar updater (macOS). Runs hourly via launchd; replaces ~/TripRadar with the latest release.
# The extension notices the new manifest.json on disk and reloads itself.
set -euo pipefail
REPO="yemredurmuss-hue/trip-radar"
DIR="$HOME/TripRadar"
RAW="${TRIP_RADAR_RAW:-https://raw.githubusercontent.com/$REPO/release}"
ZIP="${TRIP_RADAR_ZIP:-https://codeload.github.com/$REPO/zip/refs/heads/release}"
DIR="${TRIP_RADAR_DIR:-$DIR}"

version_of() { grep -o '"version"[^,]*' "$1" 2>/dev/null | sed 's/.*"\([^"]*\)"$/\1/'; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$RAW/extension/manifest.json?t=$(date +%s)" -o "$TMP/remote.json"
remote="$(version_of "$TMP/remote.json")"
local_v="$(version_of "$DIR/manifest.json" || true)"
if [ -n "$remote" ] && [ "$remote" = "$local_v" ]; then
  exit 0
fi

curl -fsSL "$ZIP" -o "$TMP/release.zip"
unzip -q "$TMP/release.zip" -d "$TMP/unzipped"
SRC="$(find "$TMP/unzipped" -maxdepth 2 -type d -name extension | head -1)"
[ -f "$SRC/manifest.json" ] || { echo "release has no extension/manifest.json" >&2; exit 1; }

# Build the new version next to the old one, then swap folders in one step: the extension never
# sees a half-written version, and reloads once it notices the new manifest.json.
rm -rf "$DIR.new" "$DIR.old"
cp -R "$SRC" "$DIR.new"
[ -d "$DIR" ] && mv "$DIR" "$DIR.old"
mv "$DIR.new" "$DIR"
rm -rf "$DIR.old"
echo "$(date '+%F %T') updated ${local_v:-none} -> $remote"
