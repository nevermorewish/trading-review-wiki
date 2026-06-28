import { useState, useEffect, useCallback } from "react"
import {
  FileText, Users, Lightbulb, BookOpen, HelpCircle, GitMerge, BarChart3, ChevronRight, ChevronDown, Layout, Globe,
  TrendingUp, Filter, Target, Calculator, AlertTriangle, Activity, Sparkles, FileCheck2, Search, X,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useWikiStore } from "@/stores/wiki-store"
import { listDirectory, listWikiPages } from "@/commands/fs"
import type { FileNode } from "@/types/wiki"
import { normalizePath } from "@/lib/path-utils"

interface WikiPageInfo {
  path: string
  title: string
  group: string
  tags: string[]
  origin?: string
}

/**
 * Groups are keyed by the wiki **subdirectory** — the real organizing unit the
 * ingest writes into (e.g. `wiki/股票/`, `wiki/选股/`). Both the Chinese
 * trading-review directories and the legacy English taxonomy are mapped to an
 * icon/label/order. Unknown directories still render as their own group
 * (labelled by the directory name) instead of being lumped into "Other".
 */
const GROUP_CONFIG: Record<string, { icon: typeof FileText; label: string; color: string; order: number }> = {
  overview:    { icon: Layout,        label: "总览",     color: "text-yellow-500",  order: 0 },
  // Chinese (trading-review domain)
  股票:        { icon: TrendingUp,    label: "股票",     color: "text-blue-500",    order: 1 },
  选股:        { icon: Filter,        label: "选股",     color: "text-cyan-500",    order: 2 },
  策略:        { icon: Target,        label: "策略",     color: "text-purple-500",  order: 3 },
  模式:        { icon: Sparkles,      label: "模式",     color: "text-pink-500",    order: 4 },
  公式:        { icon: Calculator,    label: "公式",     color: "text-indigo-500",  order: 5 },
  市场环境:    { icon: Activity,      label: "市场环境", color: "text-emerald-500", order: 6 },
  错误:        { icon: AlertTriangle, label: "错误",     color: "text-red-500",     order: 7 },
  进化:        { icon: Sparkles,      label: "进化",     color: "text-amber-500",   order: 8 },
  总结:        { icon: FileCheck2,    label: "总结",     color: "text-teal-500",    order: 9 },
  概念:        { icon: Lightbulb,     label: "概念",     color: "text-purple-500",  order: 11 },
  源文档:      { icon: BookOpen,      label: "源文档",   color: "text-orange-500",  order: 12 },
  查询:        { icon: HelpCircle,    label: "查询",     color: "text-green-500",   order: 15 },
  // English (legacy / generic taxonomy)
  entities:    { icon: Users,         label: "实体",     color: "text-blue-500",    order: 10 },
  concepts:    { icon: Lightbulb,     label: "概念",     color: "text-purple-500",  order: 11 },
  sources:     { icon: BookOpen,      label: "源文档",   color: "text-orange-500",  order: 12 },
  synthesis:   { icon: GitMerge,      label: "综合",     color: "text-red-500",     order: 13 },
  comparisons: { icon: BarChart3,     label: "对比",     color: "text-emerald-500", order: 14 },
  queries:     { icon: HelpCircle,    label: "查询",     color: "text-green-500",   order: 15 },
}

const UNKNOWN_ORDER = 50
const OTHER_CONFIG = { icon: FileText, label: "其他", color: "text-muted-foreground", order: 99 }

/** Resolve display config for a group key, falling back to the dir name itself. */
function configFor(group: string) {
  if (group === "__other__") return OTHER_CONFIG
  return GROUP_CONFIG[group] ?? { icon: FileText, label: group, color: "text-muted-foreground", order: UNKNOWN_ORDER }
}

/** First path segment under `wiki/` — the page's group. `overview.md` is special. */
function wikiGroupOf(path: string): string {
  const norm = path.replace(/\\/g, "/")
  const idx = norm.lastIndexOf("/wiki/")
  if (idx === -1) return "__other__"
  const parts = norm.slice(idx + "/wiki/".length).split("/").filter(Boolean)
  if (parts.length <= 1) {
    return parts[0]?.toLowerCase() === "overview.md" ? "overview" : "__other__"
  }
  return parts[0]
}

export function KnowledgeTree() {
  const project = useWikiStore((s) => s.project)
  const selectedFile = useWikiStore((s) => s.selectedFile)
  const setSelectedFile = useWikiStore((s) => s.setSelectedFile)
  const fileTree = useWikiStore((s) => s.fileTree)
  const [pages, setPages] = useState<WikiPageInfo[]>([])
  const [query, setQuery] = useState("")
  // Track collapsed groups (inverse of expanded) so newly-discovered Chinese
  // directories default to open instead of needing to be in a hardcoded list.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const loadPages = useCallback(async () => {
    if (!project) return
    const pp = normalizePath(project.path)
    try {
      // Single native call parses frontmatter for all pages — replaces the old
      // per-file readFile loop that did thousands of IPC round-trips.
      const metas = await listWikiPages(`${pp}/wiki`)
      const pageInfos: WikiPageInfo[] = metas.map((m) => ({
        path: m.path,
        title: m.title,
        group: wikiGroupOf(m.path),
        tags: m.tags,
        origin: m.origin,
      }))
      setPages(pageInfos)
    } catch {
      setPages([])
    }
  }, [project])

  // Reload when file tree changes (after ingest writes new pages)
  useEffect(() => {
    loadPages()
  }, [loadPages, fileTree])

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        未打开项目
      </div>
    )
  }

  // Filter by title (case-insensitive). When searching, matching groups are
  // force-expanded so hits are visible regardless of collapse state.
  const q = query.trim().toLowerCase()
  const visiblePages = q
    ? pages.filter((p) => p.title.toLowerCase().includes(q))
    : pages

  // Group pages by their wiki subdirectory
  const grouped = new Map<string, WikiPageInfo[]>()
  for (const page of visiblePages) {
    const list = grouped.get(page.group) ?? []
    list.push(page)
    grouped.set(page.group, list)
  }

  // Sort groups by configured order, then alphabetically by label
  const sortedGroups = [...grouped.entries()].sort((a, b) => {
    const ca = configFor(a[0])
    const cb = configFor(b[0])
    if (ca.order !== cb.order) return ca.order - cb.order
    return ca.label.localeCompare(cb.label)
  })

  function toggleType(group: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索知识树…"
            className="w-full rounded-md border bg-background py-1 pl-7 pr-7 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
              title="清除"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          <div className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground">
            {project.name}
          </div>

          {sortedGroups.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              {q ? "没有匹配的页面。" : "暂无知识库页面，导入资料后开始。"}
            </div>
          )}

          {sortedGroups.map(([group, items]) => {
            const config = configFor(group)
            const Icon = config.icon
            // While searching, force every group with hits open.
            const isExpanded = q ? true : !collapsedGroups.has(group)

          return (
            <div key={group} className="mb-1">
              <button
                onClick={() => toggleType(group)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                <span className="flex-1 text-left font-medium">{config.label}</span>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </button>

              {isExpanded && (
                <div className="ml-3">
                  {items.map((page) => {
                    const isSelected = selectedFile === page.path
                    return (
                      <button
                        key={page.path}
                        onClick={() => setSelectedFile(page.path)}
                        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm ${
                          isSelected
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                        }`}
                        title={page.path}
                      >
                        {page.origin === "web-clip" && <Globe className="h-3 w-3 shrink-0 text-blue-400" />}
                        <span className="truncate">{page.title}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            )
          })}

          {/* Raw sources quick access (hidden while searching the knowledge tree) */}
          {!q && <RawSourcesSection />}
        </div>
      </ScrollArea>
    </div>
  )
}

function RawSourcesSection() {
  const project = useWikiStore((s) => s.project)
  const setSelectedFile = useWikiStore((s) => s.setSelectedFile)
  const selectedFile = useWikiStore((s) => s.selectedFile)
  const [expanded, setExpanded] = useState(false)
  const [sources, setSources] = useState<FileNode[]>([])

  useEffect(() => {
    if (!project) return
    const pp = normalizePath(project.path)
    listDirectory(`${pp}/raw/sources`)
      .then((tree) => setSources(flattenAllFiles(tree)))
      .catch(() => setSources([]))
  }, [project])

  if (sources.length === 0) return null

  return (
    <div className="mt-2 border-t pt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <BookOpen className="h-3.5 w-3.5 shrink-0 text-amber-600" />
        <span className="flex-1 text-left font-medium text-muted-foreground">原始资料</span>
        <span className="text-xs text-muted-foreground">{sources.length}</span>
      </button>
      {expanded && (
        <div className="ml-3">
          {sources.map((file) => {
            const isSelected = selectedFile === file.path
            return (
              <button
                key={file.path}
                onClick={() => setSelectedFile(file.path)}
                className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm ${
                  isSelected
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                }`}
              >
                <span className="truncate">{file.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function flattenAllFiles(nodes: FileNode[]): FileNode[] {
  const files: FileNode[] = []
  for (const node of nodes) {
    if (node.is_dir && node.children) {
      files.push(...flattenAllFiles(node.children))
    } else if (!node.is_dir) {
      files.push(node)
    }
  }
  return files
}
