#!/bin/bash
# Trip Radar updater (macOS). launchd runs it every minute. When the release branch moves, it puts
# the new build in ~/TripRadar (the extension notices and reloads itself) and keeps itself current.
# The check asks git directly which commit the release branch is on, so there's no CDN cache delay;
# downloads are by commit, so they are never stale either.
set -euo pipefail
REPO="yemredurmuss-hue/trip-radar"
DIR="${TRIP_RADAR_DIR:-$HOME/TripRadar}"
APP="${TRIP_RADAR_APP:-$HOME/Library/Application Support/TripRadar}"
REFS="${TRIP_RADAR_REFS:-https://github.com/$REPO.git/info/refs?service=git-upload-pack}"
ZIPS="${TRIP_RADAR_ZIPS:-https://codeload.github.com/$REPO/zip}"
STATE="$APP/release.sha"

version_of() { grep -o '"version"[^,]*' "$1" 2>/dev/null | sed 's/.*"\([^"]*\)"$/\1/'; }

# Which commit is the release branch on? Offline or GitHub unreachable: quietly try again next minute.
sha="$(curl -fsS --max-time 20 "$REFS" 2>/dev/null | LC_ALL=C grep -a ' refs/heads/release$' | head -1 | sed -E 's/^[0-9a-f]{4}([0-9a-f]{40}) .*/\1/' || true)"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || exit 0
if [ -f "$STATE" ] && [ "$(cat "$STATE")" = "$sha" ] && [ -f "$DIR/manifest.json" ]; then
  exit 0
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL --max-time 180 "$ZIPS/$sha" -o "$TMP/release.zip"
unzip -q "$TMP/release.zip" -d "$TMP/unzipped"
SRC="$(find "$TMP/unzipped" -maxdepth 2 -type d -name extension | head -1)"
[ -f "$SRC/manifest.json" ] || { echo "release has no extension/manifest.json" >&2; exit 1; }
before="$(version_of "$DIR/manifest.json" || true)"

# Build the new version next to the old one, then swap folders in one step: the extension never
# sees a half-written version, and reloads once it notices the new manifest.json.
mkdir -p "$(dirname "$DIR")"
rm -rf "$DIR.new" "$DIR.old"
cp -R "$SRC" "$DIR.new"
[ -d "$DIR" ] && mv "$DIR" "$DIR.old"
mv "$DIR.new" "$DIR"
rm -rf "$DIR.old"

# The updater updates itself too (a new file, so this running copy is untouched; used from the next run).
mkdir -p "$APP"
NEXT="$(dirname "$SRC")/update.sh"
if [ -f "$NEXT" ] && ! cmp -s "$NEXT" "$APP/update.sh"; then
  cp "$NEXT" "$APP/update.sh.new" && chmod +x "$APP/update.sh.new" && mv "$APP/update.sh.new" "$APP/update.sh"
fi
echo "$sha" > "$STATE"
echo "$(date '+%F %T') updated ${before:-none} -> $(version_of "$DIR/manifest.json") (${sha:0:7})"
