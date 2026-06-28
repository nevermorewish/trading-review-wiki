import { invoke } from "@tauri-apps/api/core"

export interface FrogclawLoginResult {
  user_id: number
  username: string
  display_name: string
  access_token: string
  models: string[]
}

/**
 * Log in to a New API-compatible relay (frogclaw / sub2api) with username +
 * password. Runs the full login → models → token flow in Rust (a cookie jar is
 * needed because login returns a session cookie). On success returns a usable
 * `sk-` relay token plus the account's available model list.
 */
export async function frogclawLogin(
  baseUrl: string,
  username: string,
  password: string,
  group?: string,
): Promise<FrogclawLoginResult> {
  return invoke<FrogclawLoginResult>("frogclaw_login", {
    baseUrl,
    username,
    password,
    group: group ?? null,
  })
}
