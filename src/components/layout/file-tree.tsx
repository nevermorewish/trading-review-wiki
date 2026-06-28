import { useState } from "react"
import { ChevronRight, ChevronDown, File, Folder, Search, X } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useWikiStore } from "@/stores/wiki-store"
import type { FileNode } from "@/types/wiki"
import { useTranslation } from "react-i18next"

function TreeNode({ node, depth, forceExpand }: { node: FileNode; depth: number; forceExpand: boolean }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const selectedFile = useWikiStore((s) => s.selectedFile)
  const setSelectedFile = useWikiStore((s) => s.setSelectedFile)

  const isSelected = selectedFile === node.path
  const paddingLeft = 12 + depth * 16
  // While filtering, every surviving branch is shown open so matches are visible.
  const isExpanded = forceExpand || expanded

  if (node.is_dir) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-1 py-1 text-sm text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
          style={{ paddingLeft }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <Folder className="h-3.5 w-3.5 shrink-0 text-blue-400" />
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children?.map((child) => (
          <TreeNode key={child.path} node={child} depth={depth + 1} forceExpand={forceExpand} />
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => setSelectedFile(node.path)}
      className={`flex w-full items-center gap-1 py-1 text-sm ${
        isSelected
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
      }`}
      style={{ paddingLeft: paddingLeft + 14 }}
    >
      <File className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

/**
 * Prune the tree to nodes matching `q` (case-insensitive) by name. A directory
 * is kept when its own name matches (entire subtree retained) or when any
 * descendant matches (only matching descendants retained).
 */
function filterTree(nodes: FileNode[], q: string): FileNode[] {
  const out: FileNode[] = []
  for (const node of nodes) {
    const selfMatch = node.name.toLowerCase().includes(q)
    if (node.is_dir) {
      if (selfMatch) {
        out.push(node) // keep whole subtree
      } else {
        const kids = node.children ? filterTree(node.children, q) : []
        if (kids.length > 0) out.push({ ...node, children: kids })
      }
    } else if (selfMatch) {
      out.push(node)
    }
  }
  return out
}

export function FileTree() {
  const { t } = useTranslation()
  const fileTree = useWikiStore((s) => s.fileTree)
  const project = useWikiStore((s) => s.project)
  const [query, setQuery] = useState("")

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
        {t("fileTree.noProject")}
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const nodes = q ? filterTree(fileTree, q) : fileTree

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索文件…"
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
      <ScrollArea className="flex-1 min-w-0 overflow-hidden">
        <div className="p-2">
          <div className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground">
            {project.name}
          </div>
          {q && nodes.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              没有匹配的文件。
            </div>
          )}
          {nodes.map((node) => (
            <TreeNode key={node.path} node={node} depth={0} forceExpand={!!q} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
