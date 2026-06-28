import { useEffect, useMemo, useState } from "react"
import { FolderOpen, RefreshCw } from "lucide-react"
import { clipServerStatus } from "@/commands/fs"
import { BUILD_COMMIT, BUILD_DATE, DESKTOP_VERSION, versionLabel } from "@/lib/build-info"
import { checkDesktopUpdate, dispatchDesktopUpdateDialog, shouldShowDesktopUpdateNotice } from "@/lib/desktop-update"
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
  const [desktopUpdatePhase, setDesktopUpdatePhase] = useState<"idle" | "checking" | "latest" | "available" | "error">("idle")
  const [desktopUpdateMessage, setDesktopUpdateMessage] = useState("检查桌面端更新")

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
  const shortCommit = BUILD_COMMIT && BUILD_COMMIT !== "unknown" ? BUILD_COMMIT.slice(0, 7) : null

  const checkForDesktopUpdate = async () => {
    if (desktopUpdatePhase === "checking") return
    setDesktopUpdatePhase("checking")
    setDesktopUpdateMessage("正在检查桌面端更新")
    const result = await checkDesktopUpdate()
    if (shouldShowDesktopUpdateNotice(result)) {
      setDesktopUpdatePhase("available")
      setDesktopUpdateMessage(`发现新版本 ${versionLabel(result.latestVersion)}`)
      dispatchDesktopUpdateDialog(result)
      return
    }
    if (!result.ok) {
      setDesktopUpdatePhase("error")
      setDesktopUpdateMessage(result.error ?? "桌面端更新检查失败")
      return
    }
    setDesktopUpdatePhase("latest")
    setDesktopUpdateMessage(`当前已是最新版本 ${versionLabel(result.currentVersion)}`)
  }

  const updateButtonClass = [
    "inline-flex h-5 shrink-0 items-center gap-1 rounded border px-1.5 text-[10px] transition-colors",
    desktopUpdatePhase === "available"
      ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
      : desktopUpdatePhase === "error"
        ? "border-destructive/40 text-destructive hover:bg-destructive/10"
        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
  ].join(" ")

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

      <div className="flex shrink-0 items-center gap-1.5" title={BUILD_DATE === "unknown" ? undefined : `构建时间：${BUILD_DATE}`}>
        <span className="shrink-0 text-muted-foreground">桌面端</span>
        <span className="font-mono text-foreground/80">{versionLabel(DESKTOP_VERSION)}</span>
        {shortCommit && <span className="font-mono text-muted-foreground">{shortCommit}</span>}
      </div>

      <button
        type="button"
        className={updateButtonClass}
        onClick={() => void checkForDesktopUpdate()}
        disabled={desktopUpdatePhase === "checking"}
        title={desktopUpdateMessage}
        aria-label={desktopUpdateMessage}
      >
        <RefreshCw className={`h-3 w-3 ${desktopUpdatePhase === "checking" ? "animate-spin" : ""}`} aria-hidden="true" />
        <span>检查更新</span>
      </button>

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
