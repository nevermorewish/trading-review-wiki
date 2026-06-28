import { useEffect, useState } from "react"
import { Download, Sparkles } from "lucide-react"
import {
  DESKTOP_UPDATE_DIALOG_EVENT,
  checkDesktopUpdate,
  installDesktopUpdate,
  shouldShowDesktopUpdateNotice,
  type DesktopInstallUpdateProgress,
  type DesktopUpdateCheckResult,
} from "@/lib/desktop-update"
import { versionLabel } from "@/lib/build-info"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const UPDATE_PROGRESS_EVENT = "desktop-update-progress"

let autoCheckPromise: Promise<DesktopUpdateCheckResult> | null = null

function startAutoCheckIfNeeded(): Promise<DesktopUpdateCheckResult> {
  if (!autoCheckPromise) autoCheckPromise = checkDesktopUpdate()
  return autoCheckPromise
}

function formatBytes(value: number | null | undefined): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return ""
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${Math.round(value)} B`
}

function progressStageLabel(progress: DesktopInstallUpdateProgress): string {
  switch (progress.stage) {
    case "starting":
      return "正在检查更新清单"
    case "downloading":
      return "正在下载安装包"
    case "verifying":
      return "正在校验安装包"
    case "launching":
      return "正在打开安装包"
    case "complete":
      return "安装包已打开"
    case "error":
      return "更新安装失败"
    default:
      return progress.message || "正在处理更新"
  }
}

function progressBytesLabel(progress: DesktopInstallUpdateProgress): string {
  const downloaded = formatBytes(progress.bytesDownloaded)
  const total = formatBytes(progress.bytesTotal)
  if (downloaded && total) return `已下载 ${downloaded} / ${total}`
  if (downloaded) return `已下载 ${downloaded}`
  return progress.fileName || ""
}

export function DesktopUpdateNotifier() {
  const [result, setResult] = useState<DesktopUpdateCheckResult | null>(null)
  const [open, setOpen] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installMessage, setInstallMessage] = useState<string | null>(null)
  const [installError, setInstallError] = useState<string | null>(null)
  const [installProgress, setInstallProgress] = useState<DesktopInstallUpdateProgress | null>(null)

  useEffect(() => {
    let cancelled = false
    startAutoCheckIfNeeded().then((next) => {
      if (cancelled) return
      if (shouldShowDesktopUpdateNotice(next)) {
        setResult(next)
        setOpen(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let cancelled = false
    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<DesktopInstallUpdateProgress>(UPDATE_PROGRESS_EVENT, (event) => {
          if (!cancelled) setInstallProgress(event.payload)
        }),
      )
      .then((nextUnlisten) => {
        if (cancelled) {
          nextUnlisten()
          return
        }
        unlisten = nextUnlisten
      })
      .catch(() => {
        /* Progress events are only available in the Tauri shell. */
      })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [])

  useEffect(() => {
    const handleManualOpen = (event: Event) => {
      const detail = (event as CustomEvent<DesktopUpdateCheckResult>).detail
      if (!shouldShowDesktopUpdateNotice(detail)) return
      setResult(detail)
      setInstallMessage(null)
      setInstallError(null)
      setInstallProgress(null)
      setOpen(true)
    }

    window.addEventListener(DESKTOP_UPDATE_DIALOG_EVENT, handleManualOpen)
    return () => window.removeEventListener(DESKTOP_UPDATE_DIALOG_EVENT, handleManualOpen)
  }, [])

  const close = () => {
    setOpen(false)
    if (!installing) setInstallProgress(null)
  }

  const install = async () => {
    setInstalling(true)
    setInstallError(null)
    setInstallProgress({ stage: "starting", bytesDownloaded: 0 })
    setInstallMessage("正在下载安装包...")
    try {
      const installResult = await installDesktopUpdate()
      if (!installResult.ok) {
        setInstallError(installResult.error ?? "桌面端更新安装失败")
        setInstallMessage(null)
        setInstallProgress((current) => current ?? {
          stage: "error",
          bytesDownloaded: installResult.bytesDownloaded,
          bytesTotal: installResult.bytesTotal,
          message: installResult.error,
        })
        return
      }
      const fileName = installResult.asset?.fileName ?? installResult.filePath?.split(/[\\/]/).pop()
      setInstallProgress({
        stage: "complete",
        bytesDownloaded: installResult.bytesDownloaded,
        bytesTotal: installResult.bytesTotal,
        percent: installResult.bytesTotal ? 100 : undefined,
        fileName,
      })
      setInstallMessage(
        fileName
          ? `安装包已下载并打开：${fileName}。请按系统提示完成覆盖安装。`
          : "安装包已下载并打开。请按系统提示完成覆盖安装。",
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "桌面端更新安装失败")
      setInstallError(message)
      setInstallMessage(null)
      setInstallProgress((current) => current ?? {
        stage: "error",
        bytesDownloaded: 0,
        message,
      })
    } finally {
      setInstalling(false)
    }
  }

  const progressPercent = installProgress?.percent ?? undefined
  const showProgress = Boolean(installing || installProgress)

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DialogContent className="max-w-md" aria-describedby="desktop-update-desc">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            发现桌面端新版本
          </DialogTitle>
          <DialogDescription id="desktop-update-desc">
            已发布 {versionLabel(result?.latestVersion)}。点击“下载安装”会下载当前系统的安装包并自动打开，请按系统提示完成覆盖安装。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-3 text-xs">
          <div className="space-y-1">
            <div className="text-muted-foreground">当前版本</div>
            <div className="font-medium text-foreground">{versionLabel(result?.currentVersion)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground">最新版本</div>
            <div className="font-medium text-foreground">{versionLabel(result?.latestVersion)}</div>
          </div>
        </div>

        {(installMessage || installError) && (
          <div className={installError ? "rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive" : "rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground"}>
            {installError ?? installMessage}
          </div>
        )}

        {showProgress && (
          <div className="space-y-2 rounded-lg border bg-background p-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span>{installProgress ? progressStageLabel(installProgress) : "正在下载安装包"}</span>
              {progressPercent !== undefined && <b>{progressPercent}%</b>}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={progressPercent === undefined ? "h-full w-1/3 animate-pulse rounded-full bg-primary" : "h-full rounded-full bg-primary transition-[width]"}
                style={progressPercent !== undefined ? { width: `${progressPercent}%` } : undefined}
              />
            </div>
            {installProgress && (
              <div className="text-muted-foreground">{progressBytesLabel(installProgress)}</div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={installing}>
            本版本不再提醒
          </Button>
          <Button type="button" onClick={() => void install()} disabled={installing}>
            <Download className="size-4" aria-hidden="true" />
            {installing ? "下载中..." : "下载安装"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
