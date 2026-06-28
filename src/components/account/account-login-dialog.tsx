import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ExternalLink, Eye, EyeOff, Loader2, LogIn, LogOut, UserPlus, X } from "lucide-react"
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
import { BRANDS, DEFAULT_BRAND_ID, brandChatEndpoint, getBrand } from "@/lib/brands"
import { frogclawLogin } from "@/commands/frogclaw"
import { saveBrandAuth, saveLlmConfig } from "@/lib/project-store"

type Step = "credentials" | "models"

const MODEL_NAME_COLLATOR = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
})

async function openExternal(url: string) {
  if (!url) return
  try {
    await invoke("plugin:opener|open_url", { url })
  } catch {
    window.open(url, "_blank", "noopener,noreferrer")
  }
}

function sortModelNames(models: string[]): string[] {
  return [...models].sort((a, b) => MODEL_NAME_COLLATOR.compare(a, b))
}

function modelMatchKeys(model: string): string[] {
  const normalized = model.trim().toLowerCase()
  const slash = normalized.lastIndexOf("/")
  return slash >= 0 ? [normalized, normalized.slice(slash + 1)] : [normalized]
}

function partitionDefaultModels(models: string[], defaults: readonly string[] | undefined) {
  const defaultKeys = (defaults ?? []).map((model) => model.trim().toLowerCase()).filter(Boolean)
  if (defaultKeys.length === 0) return { recommendedModels: [], otherModels: models }

  const byKey = new Map<string, string[]>()
  for (const model of models) {
    for (const key of modelMatchKeys(model)) {
      const bucket = byKey.get(key) ?? []
      bucket.push(model)
      byKey.set(key, bucket)
    }
  }

  const selectedDefaults = new Set<string>()
  const recommendedModels: string[] = []
  for (const key of defaultKeys) {
    for (const model of byKey.get(key) ?? []) {
      if (selectedDefaults.has(model)) continue
      selectedDefaults.add(model)
      recommendedModels.push(model)
    }
  }

  return {
    recommendedModels,
    otherModels: models.filter((model) => !selectedDefaults.has(model)),
  }
}

function modelUsesMessages(model: string): boolean {
  const lower = model.toLowerCase()
  return lower.includes("claude") || lower.startsWith("anthropic/")
}

function brandLlmConfig(base: LlmConfig, auth: BrandAuth, model: string): LlmConfig {
  return {
    ...base,
    provider: "frogclaw",
    apiKey: auth.accessToken,
    model,
    customEndpoint: auth.baseUrl ? brandChatEndpoint(auth.baseUrl) : "",
  }
}

function modelDescription(model: string, brandId: string): string {
  const brand = getBrand(brandId)
  const keys = modelMatchKeys(model)
  for (const key of keys) {
    const exact = brand.accountModelDescriptions[key]
    if (exact) return exact
  }
  return brand.accountModelDescriptions[model] ?? ""
}

function ModelOptionRow({
  model,
  checked,
  brandId,
  onToggle,
}: {
  model: string
  checked: boolean
  brandId: string
  onToggle: () => void
}) {
  const description = modelDescription(model, brandId)
  const protocol = modelUsesMessages(model)
    ? { label: "anthropic", title: "/v1/messages" }
    : { label: "openai", title: "/v1/chat/completions" }

  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60">
      <input type="checkbox" className="mt-1" checked={checked} onChange={onToggle} />
      <span className="min-w-0 flex-1">
        <span className="block break-all font-medium">{model}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <span
        className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
        title={protocol.title}
      >
        {protocol.label}
      </span>
    </label>
  )
}

export function AccountLoginDialog({
  open,
  onOpenChange,
  configuredModels,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  configuredModels?: string[]
}) {
  const brandAuth = useWikiStore((s) => s.brandAuth)
  const setBrandAuth = useWikiStore((s) => s.setBrandAuth)
  const setLlmConfig = useWikiStore((s) => s.setLlmConfig)

  const [step, setStep] = useState<Step>("credentials")
  const [brandId, setBrandId] = useState(brandAuth.brandId || DEFAULT_BRAND_ID)
  const [baseUrl, setBaseUrl] = useState(
    brandAuth.baseUrl || getBrand(brandAuth.brandId || DEFAULT_BRAND_ID).defaultBaseUrl,
  )
  const [username, setUsername] = useState(brandAuth.username)
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recommendedModels, setRecommendedModels] = useState<string[]>([])
  const [otherModels, setOtherModels] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const initializedForOpen = useRef(false)
  const brand = getBrand(brandId)
  const allModels = useMemo(() => [...recommendedModels, ...otherModels], [recommendedModels, otherModels])

  useEffect(() => {
    if (!open) {
      initializedForOpen.current = false
      return
    }
    if (initializedForOpen.current) return
    initializedForOpen.current = true

    const authBrandId = brandAuth.brandId || DEFAULT_BRAND_ID
    const authBrand = getBrand(authBrandId)
    setBrandId(authBrandId)
    setBaseUrl(brandAuth.baseUrl || authBrand.defaultBaseUrl)
    setUsername(brandAuth.username)
    setPassword("")
    setError(null)

    const available = sortModelNames(brandAuth.availableModels?.length ? brandAuth.availableModels : brandAuth.models)
    const groups = partitionDefaultModels(available, authBrand.accountDefaultModels)
    setRecommendedModels(groups.recommendedModels)
    setOtherModels(groups.otherModels)
    setSelected(new Set(configuredModels?.length ? configuredModels : brandAuth.models))
    setStep(brandAuth.loggedIn ? "models" : "credentials")
  }, [open, brandAuth, configuredModels])

  async function persistAuth(auth: BrandAuth) {
    setBrandAuth(auth)
    await saveBrandAuth(auth)
  }

  async function applyConfig(auth: BrandAuth, model: string) {
    const cfg = brandLlmConfig(useWikiStore.getState().llmConfig, auth, model)
    setLlmConfig(cfg)
    await saveLlmConfig(cfg)
  }

  async function handleLogin() {
    if (!baseUrl.trim()) return setError("请填写服务地址")
    if (!username.trim() || !password) return setError("请填写账号和密码")
    setError(null)
    setLoggingIn(true)
    try {
      const activeBrand = getBrand(brandId)
      const result = await frogclawLogin(baseUrl.trim(), username.trim(), password, activeBrand.group)
      const models = sortModelNames(result.models)
      const groups = partitionDefaultModels(models, activeBrand.accountDefaultModels)
      const auth: BrandAuth = {
        brandId,
        baseUrl: baseUrl.trim().replace(/\/$/, ""),
        username: result.username,
        userId: result.user_id,
        accessToken: result.access_token,
        availableModels: models,
        models: brandAuth.brandId === brandId ? brandAuth.models.filter((m) => models.includes(m)) : [],
        defaultModel: brandAuth.brandId === brandId && models.includes(brandAuth.defaultModel) ? brandAuth.defaultModel : "",
        loggedIn: true,
      }
      setRecommendedModels(groups.recommendedModels)
      setOtherModels(groups.otherModels)
      setSelected(new Set(auth.models.length > 0 ? auth.models : groups.recommendedModels))
      await persistAuth(auth)
      setPassword("")
      setStep("models")
    } catch (err) {
      setError(typeof err === "string" ? err : err instanceof Error ? err.message : String(err))
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleSaveModels() {
    const models = allModels.filter((model) => selected.has(model))
    if (models.length === 0) return setError("请至少选择一个模型")
    setError(null)
    setSaving(true)
    try {
      const nextDefault = models.includes(brandAuth.defaultModel) ? brandAuth.defaultModel : models[0]
      const auth: BrandAuth = {
        ...brandAuth,
        brandId,
        baseUrl: baseUrl.trim().replace(/\/$/, ""),
        availableModels: allModels,
        models,
        defaultModel: nextDefault,
        loggedIn: true,
      }
      await persistAuth(auth)
      await applyConfig(auth, nextDefault)
      onOpenChange(false)
    } catch (err) {
      setError(typeof err === "string" ? err : err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    const auth: BrandAuth = {
      brandId,
      baseUrl: baseUrl.trim().replace(/\/$/, ""),
      username: "",
      userId: null,
      accessToken: "",
      availableModels: [],
      models: [],
      defaultModel: "",
      loggedIn: false,
    }
    await persistAuth(auth)
    const base = useWikiStore.getState().llmConfig
    if (base.provider === "frogclaw") {
      const cfg: LlmConfig = { ...base, apiKey: "", customEndpoint: "", model: "" }
      setLlmConfig(cfg)
      await saveLlmConfig(cfg)
    }
    setStep("credentials")
  }

  function toggleModel(model: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(model)) next.delete(model)
      else next.add(model)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-4rem)] overflow-hidden sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{step === "credentials" ? `登录 ${brand.name}` : "选择模型"}</DialogTitle>
          <DialogDescription>
            {step === "credentials"
              ? "登录账号后获取可用模型，再选择要在应用内启用的模型。"
              : `账号 ${brandAuth.username || username} 可用模型 ${allModels.length} 个。`}
          </DialogDescription>
        </DialogHeader>

        {step === "credentials" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>品牌</Label>
              <div className="flex flex-wrap gap-2">
                {BRANDS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBrandId(b.id)
                      const previousDefault = getBrand(brandId).defaultBaseUrl
                      if (!baseUrl.trim() || baseUrl === previousDefault) setBaseUrl(b.defaultBaseUrl)
                    }}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
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

            <div className="space-y-2">
              <Label>服务地址</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={brand.defaultBaseUrl}
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <Label>账号</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label>密码</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-9 font-mono"
                  autoComplete="current-password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loggingIn) void handleLogin()
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  style={{ transform: "translateY(-50%)" }}
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && <p className="break-all text-xs text-destructive">{error}</p>}

            <div className="flex items-center gap-2">
              {brand.registerUrl && (
                <Button type="button" variant="outline" onClick={() => openExternal(brand.registerUrl)} className="mr-auto">
                  <UserPlus className="mr-2 size-4" />
                  注册
                </Button>
              )}
              <Button type="button" onClick={handleLogin} disabled={loggingIn || !baseUrl.trim() || !username.trim() || !password}>
                {loggingIn ? <Loader2 className="mr-2 size-4 animate-spin" /> : <LogIn className="mr-2 size-4" />}
                {loggingIn ? "登录中..." : "登录"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{brandAuth.username || username}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {brand.name} · {baseUrl}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {brand.rechargeUrl && (
                  <Button type="button" variant="outline" size="sm" onClick={() => openExternal(brand.rechargeUrl)}>
                    <ExternalLink className="mr-1.5 size-4" />
                    充值
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="mr-1.5 size-4" />
                  登出
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set(allModels))}>
                全选
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                全不选
              </Button>
              <span className="ml-auto text-muted-foreground">
                已选 {selected.size} / 共 {allModels.length}
              </span>
            </div>

            <div className="max-h-[360px] overflow-y-auto rounded-md border p-1">
              {recommendedModels.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[11px] font-medium uppercase text-muted-foreground">
                    推荐模型
                    <span className="ml-2 font-normal normal-case">来自当前品牌配置</span>
                  </div>
                  {recommendedModels.map((model) => (
                    <ModelOptionRow
                      key={model}
                      model={model}
                      checked={selected.has(model)}
                      brandId={brandId}
                      onToggle={() => toggleModel(model)}
                    />
                  ))}
                </div>
              )}
              {otherModels.length > 0 && (
                <div className={recommendedModels.length > 0 ? "mt-2 border-t pt-2" : undefined}>
                  {recommendedModels.length > 0 && (
                    <div className="px-2 py-1 text-[11px] font-medium uppercase text-muted-foreground">其他模型</div>
                  )}
                  {otherModels.map((model) => (
                    <ModelOptionRow
                      key={model}
                      model={model}
                      checked={selected.has(model)}
                      brandId={brandId}
                      onToggle={() => toggleModel(model)}
                    />
                  ))}
                </div>
              )}
              {allModels.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">该账号暂无可用模型。</p>
              )}
            </div>

            {error && <p className="break-all text-xs text-destructive">{error}</p>}

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("credentials")}>
                返回
              </Button>
              <Button type="button" onClick={handleSaveModels} disabled={saving || selected.size === 0}>
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                {saving ? "保存中..." : `保存 ${selected.size} 个模型`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
