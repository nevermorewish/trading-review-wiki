#!/usr/bin/env bash
set -euo pipefail

target="${1:-aarch64-apple-darwin}"
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$root"
npm ci
npm run brand:sync
npm run tauri -- build --bundles dmg --target "$target"
