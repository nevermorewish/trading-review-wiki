/**
 * Brand preset for account-based login.
 *
 * Both frogclaw and sub2api are New API forks (OpenAI-compatible relays), so
 * they share one login mechanism (username + password → session → relay token).
 * A "brand" is just a named server preset: a display name + default base URL +
 * token group.
 *
 * This app is BUILD-TIME single-brand: the active brand is selected by the
 * `BRAND` env var at build time and compiled into `brands.generated.ts` by
 * `scripts/sync-brands.mjs` (`npm run brand:sync`). The login UI no longer lets
 * users switch brands — there is exactly one. This module re-exports that single
 * `BRAND` and keeps `getBrand()` as a compatibility shim so existing call sites
 * (which pass a stored `brandId`) keep working without churn.
 *
 * `defaultBaseUrl` is the relay root (no trailing slash). The OpenAI-compatible
 * chat endpoint lives at `${baseUrl}/v1`, which is what we store as the
 * provider's customEndpoint after login.
 */
import { BRAND, DEFAULT_BRAND_ID, type Brand } from "./brands.generated"

export { BRAND, DEFAULT_BRAND_ID }
export type { Brand }

/**
 * Returns the single active brand. The `_id` argument is ignored — it exists so
 * call sites that still thread a persisted `brandId` through don't need to
 * change. (The app no longer supports more than one brand per build.)
 */
export function getBrand(_id?: string): Brand {
  return BRAND
}

/** The base URL is a relay root; the OpenAI-compatible endpoint is `${base}/v1`. */
export function brandChatEndpoint(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/$/, "")}/v1`
}
