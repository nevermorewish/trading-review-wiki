/**
 * Brand presets for account-based login.
 *
 * Both frogclaw and sub2api are New API forks (OpenAI-compatible relays), so
 * they share one login mechanism (username + password → session → relay token).
 * A "brand" is just a named server preset: a display name + default base URL +
 * token group. The lowest-`order` brand is the default.
 *
 * The presets themselves live in `brands/*.json` at the repo root and are
 * compiled into `brands.generated.ts` by `scripts/sync-brands.mjs`
 * (`npm run brand:sync`). This module only adds the helper functions.
 *
 * `defaultBaseUrl` is the relay root (no trailing slash). The OpenAI-compatible
 * chat endpoint lives at `${baseUrl}/v1`, which is what we store as the
 * provider's customEndpoint after login.
 */
import { BRANDS, DEFAULT_BRAND_ID, type Brand } from "./brands.generated"

export { BRANDS, DEFAULT_BRAND_ID }
export type { Brand }

export function getBrand(id: string): Brand {
  return BRANDS.find((b) => b.id === id) ?? BRANDS[0]
}

/** The base URL is a relay root; the OpenAI-compatible endpoint is `${base}/v1`. */
export function brandChatEndpoint(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/$/, "")}/v1`
}
