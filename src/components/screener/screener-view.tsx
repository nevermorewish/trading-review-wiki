import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, FileJson, FileText, Filter, RefreshCw, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { listDirectory, readFile } from "@/commands/fs"
import { useWikiStore } from "@/stores/wiki-store"
import { getFileName, getRelativePath, normalizePath } from "@/lib/path-utils"
import type { FileNode } from "@/types/wiki"

type ScreenMode = {
  id: "mac_ranging" | "lifeline_stick" | "tianlang50" | "all"
  name: string
  description: string
  conditions: string[]
}

type ScreenerResult = {
  name: string
  path: string
  kind: "json" | "markdown"
  date: string | null
  mode: string | null
}

const SCREEN_MODES: ScreenMode[] = [
  {
    id: "mac_ranging",
    name: "MAC线上强势横盘",
    description: "MA8/MA21/MA60 多头排列，窄幅整理后关注放量突破。",
    conditions: ["MA8 > MA21 > MA60", "均线收敛小于 5%", "振幅小于 3%", "放量突破 MA8"],
  },
  {
    id: "lifeline_stick",
    name: "生命线粘合选股",
    description: "BBI/DQX/SMX 三重均线粘合，叠加 KDJ 低位信号。",
    conditions: ["三重均线粘合", "KDJ J 值低位", "出现洗盘短期信号", "卖出信号触发离场"],
  },
  {
    id: "tianlang50",
    name: "天狼50横盘筹码聚焦",
    description: "回落时长、低振幅和筹码聚焦共同过滤横盘标的。",
    conditions: ["回落时长超过 20 天", "振幅小于 3%", "近邻筹码大于 55%"],
  },
  {
    id: "all",
    name: "全部模式",
    description: "一次生成全部三种模式的选股结果。",
    conditions: ["输出 raw/选股 JSON", "输出 wiki/选股 Markdown", "便于后续复盘摄入"],
  },
]

export function ScreenerView() {
  const project = useWikiStore((s) => s.project)
  const dataVersion = useWikiStore((s) => s.dataVersion)
  const setSelectedFile = useWikiStore((s) => s.setSelectedFile)
  const setFileContent = useWikiStore((s) => s.setFileContent)
  const [results, setResults] = useState<ScreenerResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMode, setSelectedMode] = useState<ScreenMode["id"]>("all")

  const command = useMemo(
    () => `uv run python scripts/python/tdx_screener.py ${selectedMode}`,
    [selectedMode]
  )

  const loadResults = useCallback(async () => {
    if (!project) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const pp = normalizePath(project.path)
    const loaded: ScreenerResult[] = []

    for (const dir of [`${pp}/raw/选股`, `${pp}/wiki/选股`]) {
      try {
        const tree = await listDirectory(dir)
        loaded.push(...flattenFiles(tree).map(toResult))
      } catch {
        // The screener folders are created by scripts/python/tdx_screener.py.
      }
    }

    loaded.sort((a, b) => b.name.localeCompare(a.name))
    setResults(loaded)
    setLoading(false)
  }, [project])

  useEffect(() => {
    loadResults()
  }, [loadResults, dataVersion])

  async function openResult(result: ScreenerResult) {
    const content = await readFile(result.path)
    setSelectedFile(result.path)
    setFileContent(content)
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        请先打开或创建一个交易复盘项目
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <h2 className="text-2xl font-bold">选股</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              管理通达信选股桥接脚本生成的候选股票结果。
            </p>
          </div>
          <Button variant="outline" onClick={loadResults} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>

        <section className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">运行选股脚本</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {SCREEN_MODES.map((mode) => (
              <Button
                key={mode.id}
                variant={selectedMode === mode.id ? "default" : "outline"}
                onClick={() => setSelectedMode(mode.id)}
              >
                {mode.name}
              </Button>
            ))}
          </div>
          <div className="mt-4 rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
            {command}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            当前页面先展示脚本入口和结果文件。脚本运行后会写入 raw/选股 与 wiki/选股，点击刷新即可查看。
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {SCREEN_MODES.map((mode) => (
            <div key={mode.id} className="rounded-lg border bg-card p-4">
              <h3 className="font-semibold">{mode.name}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{mode.description}</p>
              <div className="mt-3 space-y-1">
                {mode.conditions.map((condition) => (
                  <div key={condition} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                    <span>{condition}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold">选股结果</h3>
            <span className="text-sm text-muted-foreground">{results.length} 个文件</span>
          </div>
          {loading ? (
            <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
              加载选股结果中...
            </div>
          ) : results.length === 0 ? (
            <div className="flex h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
              暂无选股结果。运行脚本后会在 raw/选股 和 wiki/选股 中生成文件。
            </div>
          ) : (
            <div className="divide-y">
              {results.map((result) => (
                <button
                  key={result.path}
                  onClick={() => openResult(result)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                >
                  {result.kind === "json" ? (
                    <FileJson className="h-5 w-5 shrink-0 text-amber-500" />
                  ) : (
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{result.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {getRelativePath(result.path, normalizePath(project.path))}
                    </div>
                  </div>
                  {result.date && (
                    <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {result.date}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function flattenFiles(nodes: FileNode[]): FileNode[] {
  const files: FileNode[] = []
  for (const node of nodes) {
    if (node.is_dir && node.children) {
      files.push(...flattenFiles(node.children))
    } else if (!node.is_dir) {
      files.push(node)
    }
  }
  return files
}

function toResult(file: FileNode): ScreenerResult {
  const name = getFileName(file.path) || file.name
  const date = name.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? null
  const mode = ["mac_ranging", "lifeline_stick", "tianlang50"].find((item) => name.includes(item)) ?? null

  return {
    name,
    path: file.path,
    kind: name.endsWith(".json") ? "json" : "markdown",
    date,
    mode,
  }
}
