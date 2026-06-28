import { useState } from "react"
import { open } from "@tauri-apps/plugin-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FolderOpen } from "lucide-react"
import { scaffoldProject } from "@/lib/create-project"
import { TemplatePicker } from "@/components/project/template-picker"
import type { WikiProject } from "@/types/wiki"
import { useTranslation } from "react-i18next"

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (project: WikiProject) => void
}

export function CreateProjectDialog({ open: isOpen, onOpenChange, onCreated }: CreateProjectDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState("")
  const [path, setPath] = useState("")
  const [selectedTemplate, setSelectedTemplate] = useState("trading")
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)

  async function handleBrowse() {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择保存位置",
    })
    if (selected) {
      setPath(selected)
    }
  }

  async function handleCreate() {
    if (!name.trim() || !path.trim()) {
      setError("请输入复盘库名称和保存位置")
      return
    }
    setCreating(true)
    setError("")
    try {
      const project = await scaffoldProject(name.trim(), path.trim(), selectedTemplate)

      onCreated(project)
      onOpenChange(false)
      setName("")
      setPath("")
      setSelectedTemplate("trading")
    } catch (err) {
      setError(String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("project.createTitle")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t("project.name")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("project.namePlaceholder")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("project.template")}</Label>
            <TemplatePicker selected={selectedTemplate} onSelect={setSelectedTemplate} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="path">{t("project.parentDir")}</Label>
            <div className="flex gap-2">
              <Input id="path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="C:/Users/..." className="flex-1" />
              <Button variant="outline" size="icon" onClick={handleBrowse} type="button">
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("project.cancel")}</Button>
          <Button onClick={handleCreate} disabled={creating}>{creating ? t("project.creating") : t("project.create")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
