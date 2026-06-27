/**
 * Brand presets for account-based login.
 *
 * Both frogclaw and sub2api are New API forks (OpenAI-compatible relays), so
 * they share one login mechanism (username + password → session → relay token).
 * A "brand" is just a named server preset: a display name + default base URL +
 * token group. frogclaw is the default brand.
 *
 * `baseUrl` is the relay root (no trailing slash). The OpenAI-compatible chat
 * endpoint lives at `${baseUrl}/v1`, which is what we store as the provider's
 * customEndpoint after login.
 */
export interface Brand {
  id: string
  name: string
  /** Default relay root, e.g. "https://frogclaw.example.com". User-editable. */
  defaultBaseUrl: string
  /** Token group passed to /api/token/ensure-group. */
  group: string
}

export const BRANDS: Brand[] = [
  {
    id: "frogclaw",
    name: "FrogClaw",
    defaultBaseUrl: "",
    group: "default",
  },
  {
    id: "sub2api",
    name: "Sub2API",
    defaultBaseUrl: "",
    group: "default",
  },
]

export const DEFAULT_BRAND_ID = "frogclaw"

export function getBrand(id: string): Brand {
  return BRANDS.find((b) => b.id === id) ?? BRANDS[0]
}

/** The base URL is a relay root; the OpenAI-compatible endpoint is `${base}/v1`. */
export function brandChatEndpoint(baseUrl: string): string {
  return `${baseUrl.trim().replace(/\/$/, "")}/v1`
}
