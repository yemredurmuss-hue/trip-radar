#!/bin/bash
# One-time setup:  curl -fsSL https://raw.githubusercontent.com/yemredurmuss-hue/trip-radar/release/install.sh | bash
set -euo pipefail
REPO="yemredurmuss-hue/trip-radar"
APP="$HOME/Library/Application Support/TripRadar"
PLIST="$HOME/Library/LaunchAgents/com.tripradar.update.plist"
LOG="$HOME/Library/Logs/TripRadar-update.log"

mkdir -p "$APP" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
curl -fsSL "https://raw.githubusercontent.com/$REPO/release/update.sh" -o "$APP/update.sh"
chmod +x "$APP/update.sh"
/bin/bash "$APP/update.sh"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.tripradar.update</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$APP/update.sh</string></array>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
PLIST
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load -w "$PLIST"

echo ""
echo "✓ Trip Radar kuruldu: $HOME/TripRadar (saatte bir kendini günceller)"
echo ""
echo "Son adım (bir kez): Chrome → chrome://extensions → Paketlenmemiş öğe yükle → TripRadar klasörünü seç."
echo "Eski Trip Radar varsa önce onu kaldır."
open "$HOME/TripRadar" 2>/dev/null || true
