#!/bin/bash
# The Chrome Web Store package: the build without the manifest's "key" (that pins the Mac install's id; the store
# gives the extension its own). Writes store/trip-radar-<version>.zip.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
VERSION="$(node -p 'require("./dist/manifest.json").version')"
WORK="$(mktemp -d)"
cp -R dist/. "$WORK/"
node -e 'const f=process.argv[1];const m=JSON.parse(require("fs").readFileSync(f,"utf8"));delete m.key;require("fs").writeFileSync(f,JSON.stringify(m,null,2)+"\n")' "$WORK/manifest.json"
rm -f "store/trip-radar-$VERSION.zip"
(cd "$WORK" && zip -qr -X "$OLDPWD/store/trip-radar-$VERSION.zip" .)
rm -rf "$WORK"
echo "store/trip-radar-$VERSION.zip"
