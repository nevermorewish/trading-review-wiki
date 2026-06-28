import { useEffect, useState } from "react"
import { LogIn, LogOut, Loader2, Eye, EyeOff, UserCircle2, ExternalLink } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWikiStore, type BrandAuth, type LlmConfig } from "@/stores/wiki-store"
import { BRANDS, getBrand, brandChatEndpoint, DEFAULT_BRAND_ID } from "@/lib/brands"
import { frogclawLogin } from "@/commands/frogclaw"
import { saveBrandAuth, saveLlmConfig } from "@/lib/project-store"

/** Open a URL in the system browser via the Tauri opener plugin (falls back to window.open). */
async function openExternal(url: string) {
  try {
    await invoke("plugin:opener|open_url", { url })
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

/** Build a frogclaw LlmConfig from the brand session, preserving unrelated fields. */
function brandLlmConfig(base: LlmConfig, auth: BrandAuth, model: string): LlmConfig {
  return {
    ...base,
    provider: "frogclaw",
    apiKey: auth.accessToken,
    model: model || auth.defaultModel,
    customEndpoint: auth.baseUrl ? brandChatEndpoint(auth.baseUrl) : "",
  }
}

/**
 * Standalone account login, opened from the bottom-left sidebar entry (mirrors
 * HuanXing-Hermes' AccountLoginDialog). Unlike the Settings login section, this
 * persists `llmConfig` (provider=frogclaw) immediately on login / model pick, so
 * the account is usable without visiting Settings → LLM.
 */
export function AccountLoginDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const brandAuth = useWikiStore((s) => s.brandAuth)
  const setBrandAuth = useWikiStore((s) => s.setBrandAuth)
  const setLlmConfig = useWikiStore((s) => s.setLlmConfig)

  const [brandId, setBrandId] = useState(brandAuth.brandId || DEFAULT_BRAND_ID)
  const [baseUrl, setBaseUrl] = useState(
    brandAuth.baseUrl || getBrand(brandAuth.brandId || DEFAULT_BRAND_ID).defaultBaseUrl,
  )
  const [username, setUsername] = useState(brandAuth.username)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep the form in sync if the persisted auth changes while closed.
  useEffect(() => {
    if (open && brandAuth.loggedIn) {
      setBrandId(brandAuth.brandId || DEFAULT_BRAND_ID)
      setBaseUrl(brandAuth.baseUrl)
      setUsername(brandAuth.username)
    }
  }, [open, brandAuth.loggedIn, brandAuth.brandId, brandAuth.baseUrl, brandAuth.username])

  async function applyConfig(auth: BrandAuth, model: string) {
    const base = useWikiStore.getState().llmConfig
    const cfg = brandLlmConfig(base, auth, model)
    setLlmConfig(cfg)
    await saveLlmConfig(cfg)
  }

  async function handleLogin() {
    if (!baseUrl.trim()) return setError("请填写服务器地址")
    if (!username.trim() || !password) return setError("请填写账号和密码")
    setError(null)
    setLoggingIn(true)
    try {
      const brand = getBrand(brandId)
      const result = await frogclawLogin(baseUrl.trim(), username.trim(), password, brand.group)
      const defaultModel = result.models.includes(brandAuth.defaultModel)
        ? brandAuth.defaultModel
        : result.models[0] ?? ""
      const auth: BrandAuth = {
        brandId,
        baseUrl: baseUrl.trim().replace(/\/$/, ""),
        username: result.username,
        userId: result.user_id,
        accessToken: result.access_token,
        models: result.models,
        defaultModel,
        loggedIn: true,
      }
      setBrandAuth(auth)
      await saveBrandAuth(auth)
      await applyConfig(auth, defaultModel)
      setPassword("")
    } catch (err) {
      setError(typeof err === "string" ? err : err instanceof Error ? err.message : String(err))
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleLogout() {
    const auth: BrandAuth = {
      brandId,
      baseUrl: baseUrl.trim().replace(/\/$/, ""),
      username: "",
      userId: null,
      accessToken: "",
      models: [],
      defaultModel: "",
      loggedIn: false,
    }
    setBrandAuth(auth)
    await saveBrandAuth(auth)
    // Clear the relay token from the active LlmConfig so stale creds aren't used.
    const base = useWikiStore.getState().llmConfig
    if (base.provider === "frogclaw") {
      const cfg: LlmConfig = { ...base, apiKey: "", customEndpoint: "", model: "" }
      setLlmConfig(cfg)
      await saveLlmConfig(cfg)
    }
  }

  async function handlePickModel(m: string) {
    const auth: BrandAuth = { ...brandAuth, defaultModel: m }
    setBrandAuth(auth)
    await saveBrandAuth(auth)
    await applyConfig(auth, m)
  }

  const brand = getBrand(brandAuth.loggedIn ? brandAuth.brandId : brandId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{brandAuth.loggedIn ? "账号" : "账号登录"}</DialogTitle>
          <DialogDescription>
            {brandAuth.loggedIn
              ? "已登录中转账号，可切换默认模型或退出登录。"
              : "登录中转站账号，自动获取可用模型并用于所有 AI 调用。"}
          </DialogDescription>
        </DialogHeader>

        {/* Brand selector */}
        <div className="space-y-2">
          <Label>品牌</Label>
          <div className="flex flex-wrap gap-2">
            {BRANDS.map((b) => (
              <button
                key={b.id}
                disabled={brandAuth.loggedIn}
                onClick={() => {
                  setBrandId(b.id)
                  if (!baseUrl.trim() || baseUrl === getBrand(brandId).defaultBaseUrl) {
                    setBaseUrl(b.defaultBaseUrl)
                  }
                }}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 ${
                  brandId === b.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-accent"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>

        {brandAuth.loggedIn ? (
          <>
            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
              <div className="flex items-center gap-2">
                <UserCircle2 className="size-5 text-primary" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{brandAuth.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {brand.name} · {brandAuth.baseUrl}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {brand.rechargeUrl && (
                  <Button variant="outline" size="sm" onClick={() => openExternal(brand.rechargeUrl)}>
                    <ExternalLink className="mr-1.5 size-4" />
                    充值
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="mr-1.5 size-4" />
                  退出登录
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>选择模型（默认）</Label>
              {brandAuth.models.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {brandAuth.models.map((m) => (
                    <button
                      key={m}
                      onClick={() => handlePickModel(m)}
                      title={brand.accountModelDescriptions[m] ?? m}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        brandAuth.defaultModel === m
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-accent"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">该账号暂无可用模型。</p>
              )}
              <p className="text-xs text-muted-foreground">点击模型即设为默认，立即用于所有 AI 调用。</p>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label>服务器地址</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-frogclaw-domain.com"
              />
              <p className="text-xs text-muted-foreground">中转站根地址，无需 /v1 后缀（自动拼接）。</p>
              {brand.registerUrl && (
                <button
                  type="button"
                  onClick={() => openExternal(brand.registerUrl)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="size-3" />
                  还没有账号？注册
                </button>
              )}
            </div>
            <div className="space-y-2">
              <Label>账号</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label>密码</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9 font-mono"
                  placeholder="密码"
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLogin()
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button onClick={handleLogin} disabled={loggingIn} className="w-full">
              {loggingIn ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogIn className="mr-2 size-4" />}
              {loggingIn ? "登录中…" : "登录"}
            </Button>
            {error && <p className="text-xs text-red-600 break-all">{error}</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
