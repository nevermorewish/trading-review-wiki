import { useEffect, useMemo, useState } from "react"
import { FolderOpen } from "lucide-react"
import { clipServerStatus } from "@/commands/fs"
import { getFileName } from "@/lib/path-utils"
import { useWikiStore } from "@/stores/wiki-store"

type ClipStatus = "running" | "starting" | "port_conflict" | "error" | string

function getClipStatusMeta(status: ClipStatus) {
  switch (status) {
    case "running":
      return { label: "Clip 服务", value: "运行中", dot: "bg-emerald-500" }
    case "starting":
      return { label: "Clip 服务", value: "启动中", dot: "animate-pulse bg-amber-400" }
    case "port_conflict":
      return { label: "Clip 服务", value: "端口 19827 被占用", dot: "bg-red-500" }
    case "error":
      return { label: "Clip 服务", value: "出错，重启中", dot: "animate-pulse bg-red-500" }
    default:
      return { label: "Clip 服务", value: status || "未知", dot: "bg-muted-foreground" }
  }
}

export function AppStatusBar() {
  const project = useWikiStore((s) => s.project)
  const [clipStatus, setClipStatus] = useState<ClipStatus>("starting")

  useEffect(() => {
    let disposed = false

    const check = async () => {
      try {
        const status = await clipServerStatus()
        if (!disposed) setClipStatus(status)
      } catch {
        if (!disposed) setClipStatus("error")
      }
    }

    check()
    const interval = window.setInterval(check, 30000)
    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [])

  const projectLabel = useMemo(() => {
    if (!project) return "未打开复盘目录"
    return project.name || getFileName(project.path) || project.path
  }, [project])

  const clipMeta = getClipStatusMeta(clipStatus)

  return (
    <div
      className="flex h-7 shrink-0 items-center gap-4 border-t bg-muted/60 px-3 text-[11px] text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${clipMeta.dot}`} />
        <span className="shrink-0">{clipMeta.label}</span>
        <span className="truncate text-foreground/80">{clipMeta.value}</span>
      </div>

      <div className="h-3 w-px shrink-0 bg-border" />

      <div className="flex min-w-0 items-center gap-1.5">
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="shrink-0">当前复盘目录</span>
        <span className="truncate text-foreground/80" title={project?.path ?? projectLabel}>
          {projectLabel}
        </span>
      </div>
    </div>
  )
}
