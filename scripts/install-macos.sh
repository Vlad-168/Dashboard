#!/usr/bin/env bash
# Запускает дашборд как локальный сайт http://localhost:8787 при входе в macOS
# (через launchd), чтобы Plash/Übersicht/браузер могли его открыть.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-8787}"
LABEL="com.dashboard.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

[ -f "$DIR/config.local.js" ] || cp "$DIR/config.example.js" "$DIR/config.local.js"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>/usr/bin/python3</string><string>-m</string><string>http.server</string>
    <string>$PORT</string><string>--bind</string><string>127.0.0.1</string>
    <string>--directory</string><string>$DIR</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
PL

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "✓ Дашборд запущен: http://localhost:$PORT"
echo "  Теперь добавь этот адрес в Plash (см. README)."
open "http://localhost:$PORT" 2>/dev/null || true
