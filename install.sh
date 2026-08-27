#!/usr/bin/env bash
set -euo pipefail
APP="HOSTINGG"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="$HOME/.local/bin"
DESKTOP="$HOME/.local/share/applications"
DATA="$HOME/.hostingg"

echo "== HOSTINGG installer =="

if ! command -v git >/dev/null; then
  echo "Brak git. Na CachyOS/Arch: sudo pacman -S git"
  exit 1
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Brak Node.js/npm. Na CachyOS/Arch: sudo pacman -S nodejs npm"
  exit 1
fi
if ! command -v cargo >/dev/null || ! command -v rustc >/dev/null; then
  echo "Brak Rust. Na CachyOS/Arch: sudo pacman -S rust"
  exit 1
fi

mkdir -p "$BIN" "$DESKTOP" "$DATA/servers" "$DATA/backups"
cd "$ROOT"
npm install
npm run tauri build

PKG="$ROOT/src-tauri/target/release/hostingg"
if [ ! -x "$PKG" ]; then
  echo "Nie znaleziono zbudowanej aplikacji: $PKG"
  exit 1
fi
install -Dm755 "$PKG" "$BIN/hostingg"

cat > "$DESKTOP/hostingg.desktop" <<EOF
[Desktop Entry]
Name=HOSTINGG
Comment=Minecraft server hosting manager
Exec=$BIN/hostingg
Icon=applications-games
Terminal=false
Type=Application
Categories=Game;Network;
EOF

echo
echo "HOSTINGG zainstalowany."
echo "Uruchom: hostingg"
echo "Jeśli komenda nie działa, dodaj ~/.local/bin do PATH."
