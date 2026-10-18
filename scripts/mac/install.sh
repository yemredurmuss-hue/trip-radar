#!/bin/bash
# One-time setup (also upgrades an existing install to every-minute updates):
#   curl -fsSL https://raw.githubusercontent.com/yemredurmuss-hue/trip-radar/release/install.sh | bash
set -euo pipefail
REPO="yemredurmuss-hue/trip-radar"
APP="$HOME/Library/Application Support/TripRadar"
PLIST="$HOME/Library/LaunchAgents/com.tripradar.update.plist"
LOG="$HOME/Library/Logs/TripRadar-update.log"
EXISTING=false
[ -f "$HOME/TripRadar/manifest.json" ] && EXISTING=true

mkdir -p "$APP" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
# The updater from the release's current commit (not a possibly cached copy of the branch).
SHA="$(curl -fsS "https://github.com/$REPO.git/info/refs?service=git-upload-pack" | LC_ALL=C grep -a ' refs/heads/release$' | head -1 | sed -E 's/^[0-9a-f]{4}([0-9a-f]{40}) .*/\1/' || true)"
curl -fsSL "https://raw.githubusercontent.com/$REPO/${SHA:-release}/update.sh" -o "$APP/update.sh"
chmod +x "$APP/update.sh"
rm -f "$APP/release.sha" # fetch the current build now
/bin/bash "$APP/update.sh"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.tripradar.update</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$APP/update.sh</string></array>
  <key>StartInterval</key><integer>60</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST"

echo ""
if $EXISTING; then
  echo "✓ Trip Radar güncellendi. Bundan sonra yeni sürümler 1-2 dakika içinde kendiliğinden gelir."
  echo "Chrome'da bir şey yapmana gerek yok."
else
  echo "✓ Trip Radar kuruldu: $HOME/TripRadar (yeni sürümler 1-2 dakika içinde kendiliğinden gelir)"
  echo ""
  echo "Son adım (bir kez): Chrome → chrome://extensions → Paketlenmemiş öğe yükle → TripRadar klasörünü seç."
  echo "Eski Trip Radar varsa önce onu kaldır."
  open "$HOME/TripRadar" 2>/dev/null || true
fi
