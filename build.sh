#!/usr/bin/env bash
set -euo pipefail
npm install
npm run tauri build
echo "Gotowe: src-tauri/target/release/hostingg"
