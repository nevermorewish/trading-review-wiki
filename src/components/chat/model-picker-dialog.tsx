import { Search, Settings2, Check } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getBrand } from "@/lib/brands"

const MODEL_NAME_COLLATOR = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
})

function modelMatchKeys(model: string): string[] {
  const normalized = model.trim().toLowerCase()
  const slash = normalized.lastIndexOf("/")
  return slash >= 0 ? [normalized, normalized.slice(slash + 1)] : [normalized]
}

function splitModelsByBrandRecommendation(models: string[], brandId: string) {
  const brand = getBrand(brandId)
  const recommendationKeys = brand.accountDefaultModels.map((model) => model.trim().toLowerCase()).filter(Boolean)
  const recommendedSet = new Set<string>()
  const byKey = new Map<string, string[]>()

  for (const model of models) {
    for (const key of modelMatchKeys(model)) {
      const bucket = byKey.get(key) ?? []
      bucket.push(model)
      byKey.set(key, bucket)
    }
  }

  const recommended: string[] = []
  for (const key of recommendationKeys) {
    for (const model of byKey.get(key) ?? []) {
      if (recommendedSet.has(model)) continue
      recommendedSet.add(model)
      recommended.push(model)
    }
  }

  const other = models.filter((model) => !recommendedSet.has(model))
  return {
    recommended: recommended.sort(MODEL_NAME_COLLATOR.compare),
    other: other.sort(MODEL_NAME_COLLATOR.compare),
  }
}

function modelDescription(model: string, brandId: string): string {
  const brand = getBrand(brandId)
  for (const key of modelMatchKeys(model)) {
    const description = brand.accountModelDescriptions[key]
    if (description) return description
  }
  return brand.accountModelDescriptions[model] ?? ""
}

function displayName(model: string): string {
  const slash = model.indexOf("/")
  return slash >= 0 ? model.slice(slash + 1) : model
}

function ModelRow({
  model,
  brandId,
  selected,
  onSelect,
}: {
  model: string
  brandId: string
  selected: boolean
  onSelect: () => void
}) {
  const description = modelDescription(model, brandId)

  return (
    <button
      type="button"
      className="relative w-full rounded-md border bg-background px-3 py-2 text-left transition-colors hover:bg-accent data-[selected=true]:border-primary data-[selected=true]:bg-primary/5"
      data-selected={selected}
      onClick={onSelect}
    >
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="break-all text-sm font-medium">{displayName(model)}</div>
          {model !== displayName(model) && <div className="mt-0.5 break-all text-xs text-muted-foreground">{model}</div>}
          {description && <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</div>}
        </div>
        {selected && (
          <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </button>
  )
}

export function ModelPickerDialog({
  open,
  onOpenChange,
  brandId,
  models,
  selectedModel,
  onSelectModel,
  onReconfigureModels,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  brandId: string
  models: string[]
  selectedModel: string
  onSelectModel: (model: string) => void | Promise<void>
  onReconfigureModels: () => void
}) {
  const [query, setQuery] = useState("")
  const brand = getBrand(brandId)
  const filteredModels = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return models
    return models.filter((model) => {
      const description = modelDescription(model, brandId)
      return `${model} ${displayName(model)} ${description}`.toLowerCase().includes(needle)
    })
  }, [brandId, models, query])
  const groups = useMemo(
    () => splitModelsByBrandRecommendation(filteredModels, brandId),
    [brandId, filteredModels],
  )

  async function selectModel(model: string) {
    await onSelectModel(model)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-4rem)] overflow-hidden sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>选择模型</DialogTitle>
          <DialogDescription>
            {brand.name} 已保存 {models.length} 个账号模型。点击模型会立即保存为默认模型。
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 text-muted-foreground" style={{ transform: "translateY(-50%)" }} />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
                placeholder="搜索模型"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                onReconfigureModels()
              }}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              重新选择模型
            </Button>
          </div>

          <div className="max-h-[440px] overflow-y-auto rounded-md border p-2">
            {groups.recommended.length > 0 && (
              <section className="space-y-2">
                <header className="px-1 text-xs font-medium text-muted-foreground">
                  推荐模型
                  <span className="ml-2 font-normal">来自 brands 配置</span>
                </header>
                {groups.recommended.map((model) => (
                  <ModelRow
                    key={model}
                    model={model}
                    brandId={brandId}
                    selected={model === selectedModel}
                    onSelect={() => void selectModel(model)}
                  />
                ))}
              </section>
            )}

            {groups.other.length > 0 && (
              <section className={groups.recommended.length > 0 ? "mt-3 space-y-2 border-t pt-3" : "space-y-2"}>
                <header className="px-1 text-xs font-medium text-muted-foreground">其他模型</header>
                {groups.other.map((model) => (
                  <ModelRow
                    key={model}
                    model={model}
                    brandId={brandId}
                    selected={model === selectedModel}
                    onSelect={() => void selectModel(model)}
                  />
                ))}
              </section>
            )}

            {filteredModels.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">没有匹配的模型。</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
