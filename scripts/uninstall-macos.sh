#!/usr/bin/env bash
PLIST="$HOME/Library/LaunchAgents/com.dashboard.server.plist"
launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "✓ Dashboard autostart removed"
