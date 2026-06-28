import { useState } from "react"
import { ExternalLink, LogIn, LogOut, UserCircle2, Wallet } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import { useWikiStore, type LlmConfig } from "@/stores/wiki-store"
import { getBrand } from "@/lib/brands"
import { AccountLoginDialog } from "./account-login-dialog"
import { saveBrandAuth, saveLlmConfig } from "@/lib/project-store"

async function openExternal(url: string) {
  if (!url) return
  try {
    await invoke("plugin:opener|open_url", { url })
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

/**
 * Bottom-left account entry (mirrors TradeReview's AccountLoginButton).
 * Logged-out: a "登录" button. Logged-in: the account name + brand, click to
 * manage (switch model / log out). Opens {@link AccountLoginDialog}.
 */
export function AccountLoginButton() {
  const [open, setOpen] = useState(false)
  const brandAuth = useWikiStore((s) => s.brandAuth)
  const setBrandAuth = useWikiStore((s) => s.setBrandAuth)
  const setLlmConfig = useWikiStore((s) => s.setLlmConfig)

  const rowBase =
    "flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-sm transition-colors text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"

  async function handleLogout() {
    const auth = {
      ...brandAuth,
      username: "",
      userId: null,
      accessToken: "",
      availableModels: [],
      models: [],
      defaultModel: "",
      loggedIn: false,
    }
    setBrandAuth(auth)
    await saveBrandAuth(auth)

    const base = useWikiStore.getState().llmConfig
    if (base.provider === "frogclaw") {
      const cfg: LlmConfig = { ...base, apiKey: "", customEndpoint: "", model: "" }
      setLlmConfig(cfg)
      await saveLlmConfig(cfg)
    }
  }

  return (
    <>
      {brandAuth.loggedIn ? (
        <div className="space-y-2 rounded-lg border bg-background/70 p-2">
          <button
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
            title={`${getBrand(brandAuth.brandId).name} · ${brandAuth.username}`}
          >
            <UserCircle2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{brandAuth.username || "已登录"}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {brandAuth.defaultModel || getBrand(brandAuth.brandId).name}
              </span>
            </span>
          </button>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              className="flex h-8 min-w-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={() => openExternal(getBrand(brandAuth.brandId).defaultBaseUrl)}
              title="官网"
              aria-label="官网"
            >
              <ExternalLink className="size-4" />
            </button>
            <button
              type="button"
              className="flex h-8 min-w-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
              onClick={() => openExternal(getBrand(brandAuth.brandId).rechargeUrl)}
              disabled={!getBrand(brandAuth.brandId).rechargeUrl}
              title="充值"
              aria-label="充值"
            >
              <Wallet className="size-4" />
            </button>
            <button
              type="button"
              className="flex h-8 min-w-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              onClick={handleLogout}
              title="登出"
              aria-label="登出"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className={rowBase}>
          <LogIn className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">登录账号</span>
        </button>
      )}
      <AccountLoginDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
