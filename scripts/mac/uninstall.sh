#!/bin/bash
# Stops automatic updates. Remove the extension itself from chrome://extensions.
PLIST="$HOME/Library/LaunchAgents/com.tripradar.update.plist"
launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
rm -rf "$HOME/Library/Application Support/TripRadar"
echo "Otomatik güncelleme kapatıldı. ~/TripRadar klasörünü Chrome'dan kaldırdıktan sonra silebilirsin."
