#!/usr/bin/env node
// Build-time brand injection. Reads BRAND (default "huanxingtradereview"), loads
// brands/<BRAND>.json, and rewrites the files that carry brand identity
// (src-tauri/tauri.conf.json, src-tauri/Cargo.toml) plus generates the brand
// module consumed by the frontend (src/lib/brands.generated.ts).
//
// This app used to pick a brand at RUNTIME (login screen exposed every brand).
// It is now a BUILD-TIME single-brand app: each installer is locked to one
// brand, so the desktop shell (productName / identifier / window title) matches
// the brand baked into the UI. The generated module therefore exports ONE
// `BRAND` object rather than a `BRANDS` list.
//
// Modeled on the sibling HuanXing-Hermes project's scripts/sync-brand.mjs —
// same updateJson / replaceOrThrow helpers and the same --check mode used by
// `npm run brand:check`.
import { readFileSync, writeFileSync, readdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const brandsDir = resolve(repoRoot, "brands")
const outFile = resolve(repoRoot, "src/lib/brands.generated.ts")
const tauriConf = "src-tauri/tauri.conf.json"
const cargoToml = "src-tauri/Cargo.toml"
const checkOnly = process.argv.includes("--check")

// Shell fields drive the OS-level identity (installer dir, app id, metadata).
const SHELL_STRING_FIELDS = [
  "appNameEn",
  "productName",
  "identifier",
  "publisher",
  "copyright",
  "homepage",
  "shortDescription",
  "longDescription",
]

// Runtime fields are surfaced to the frontend via the generated module.
const RUNTIME_STRING_FIELDS = ["id", "name", "defaultBaseUrl", "group", "registerUrl", "rechargeUrl"]

function fail(msg) {
  console.error(`[sync-brands] ${msg}`)
  process.exit(1)
}

function pathOf(relativePath) {
  return resolve(repoRoot, relativePath)
}

function readText(relativePath) {
  return readFileSync(pathOf(relativePath), "utf8")
}

function writeText(relativePath, content) {
  writeFileSync(pathOf(relativePath), content)
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath))
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function defaultBrandId() {
  // Lowest-order brand wins, matching the previous DEFAULT_BRAND_ID behaviour.
  const brands = readdirSync(brandsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(`brands/${f}`))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.id).localeCompare(String(b.id)))
  if (brands.length === 0) fail("no brand configs found in brands/")
  return brands[0].id
}

function loadBrand() {
  const brandId = (process.env.BRAND || defaultBrandId()).trim()
  if (!/^[a-z][a-z0-9-]*$/.test(brandId)) {
    fail(`invalid BRAND id ${JSON.stringify(brandId)} (expected lowercase kebab)`)
  }
  let raw
  try {
    raw = readJson(`brands/${brandId}.json`)
  } catch {
    fail(`cannot read brands/${brandId}.json — is BRAND=${brandId} a known brand?`)
  }
  if (raw.id !== brandId) {
    fail(`brands/${brandId}.json has id="${raw.id}" but filename implies "${brandId}"`)
  }
  for (const field of [...SHELL_STRING_FIELDS, ...RUNTIME_STRING_FIELDS]) {
    if (typeof raw[field] !== "string" || raw[field].length === 0) {
      fail(`brands/${brandId}.json missing required string field "${field}"`)
    }
  }
  if (typeof raw.order !== "number") fail(`brands/${brandId}.json missing numeric "order"`)
  if (!Array.isArray(raw.accountDefaultModels)) fail(`brands/${brandId}.json "accountDefaultModels" must be an array`)
  if (raw.accountModelDescriptions == null || typeof raw.accountModelDescriptions !== "object") {
    fail(`brands/${brandId}.json "accountModelDescriptions" must be an object`)
  }
  return raw
}

const brand = loadBrand()
const changed = []

function updateText(relativePath, updater) {
  const before = readText(relativePath)
  const after = updater(before)
  if (after === before) return
  changed.push(relativePath)
  if (!checkOnly) writeText(relativePath, after)
}

// Like updateText but for files this script *generates* — a missing file on a
// fresh checkout counts as "needs writing" rather than an error.
function writeGenerated(relativePath, content) {
  let before = null
  try {
    before = readText(relativePath)
  } catch (err) {
    if (err?.code !== "ENOENT") throw err
  }
  if (before === content) return
  changed.push(relativePath)
  if (!checkOnly) writeText(relativePath, content)
}

function updateJson(relativePath, updater) {
  const value = readJson(relativePath)
  updater(value)
  updateText(relativePath, () => stableJson(value))
}

function replaceOrThrow(text, pattern, replacement, label) {
  if (!pattern.test(text)) fail(`cannot find ${label}`)
  pattern.lastIndex = 0
  return text.replace(pattern, replacement)
}

// tauri.conf.json — productName (= NSIS install dir + shortcut), identifier,
// window title, and bundle metadata all follow the active brand.
updateJson(tauriConf, (config) => {
  config.productName = brand.productName
  config.identifier = brand.identifier
  if (Array.isArray(config.app?.windows) && config.app.windows[0]) {
    config.app.windows[0].title = brand.name
  }
  if (config.bundle) {
    config.bundle.publisher = brand.publisher
    config.bundle.homepage = brand.homepage
    config.bundle.copyright = brand.copyright
    config.bundle.shortDescription = brand.shortDescription
    config.bundle.longDescription = brand.longDescription
  }
})

// Cargo.toml — [package].description (regex-scoped to the [package] section).
updateText(cargoToml, (text) => replaceOrThrow(
  text,
  /(^\[package\][\s\S]*?^description\s*=\s*)"[^"]+"/m,
  `$1"${brand.shortDescription}"`,
  "Cargo.toml [package].description",
))

// Generated frontend module — import { BRAND } from "@/lib/brands.generated".
const runtimeBrand = {
  id: brand.id,
  name: brand.name,
  appNameEn: brand.appNameEn,
  defaultBaseUrl: brand.defaultBaseUrl,
  group: brand.group,
  order: brand.order,
  registerUrl: brand.registerUrl,
  rechargeUrl: brand.rechargeUrl,
  accountDefaultModels: brand.accountDefaultModels,
  accountModelDescriptions: brand.accountModelDescriptions ?? {},
}
const generated = `// AUTO-GENERATED by scripts/sync-brands.mjs — do not edit by hand.
// Active brand: ${brand.id}. Run \`npm run brand:sync\` (BRAND=<id>) to regenerate.

export interface Brand {
  id: string
  name: string
  /** English display name (used where ASCII is required). */
  appNameEn: string
  /** Default relay root, e.g. "https://frogclaw.example.com". User-editable. */
  defaultBaseUrl: string
  /** Token group passed to /api/token/ensure-group. */
  group: string
  /** Sort order (retained from the brand config). */
  order: number
  /** Account sign-up page (optional, "" = hidden). */
  registerUrl: string
  /** Wallet / recharge page (optional, "" = hidden). */
  rechargeUrl: string
  /** Suggested models (login still returns the authoritative list). */
  accountDefaultModels: readonly string[]
  /** Per-model blurbs shown on the model picker (optional). */
  accountModelDescriptions: Readonly<Record<string, string>>
}

export const BRAND: Brand = ${JSON.stringify(runtimeBrand, null, 2)} as const

export const DEFAULT_BRAND_ID = ${JSON.stringify(brand.id)}
`
writeGenerated(outFile, generated)

if (changed.length > 0) {
  if (checkOnly) {
    console.error(`[sync-brands] brand "${brand.id}" is not synchronized:`)
    for (const file of changed) console.error(`- ${file}`)
    process.exit(1)
  }
  console.log(`[sync-brands] synchronized brand "${brand.id}":`)
  for (const file of changed) console.log(`- ${file}`)
} else {
  console.log(`[sync-brands] brand "${brand.id}" is already synchronized.`)
}
