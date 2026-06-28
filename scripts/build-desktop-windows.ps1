param(
  [string]$Target = "x86_64-pc-windows-msvc"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $root
try {
  npm ci
  npm run brand:sync
  npm run tauri -- build --bundles nsis --target $Target
} finally {
  Pop-Location
}
