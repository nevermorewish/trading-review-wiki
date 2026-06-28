import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent } from "react"
import { Bot, ChevronDown, Paperclip, Send, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatInputProps {
  onSend: (text: string, images: File[]) => void
  onStop: () => void
  isStreaming: boolean
  placeholder?: string
  models?: string[]
  selectedModel?: string
  brandName?: string
  onOpenModelPicker?: () => void
}

export function ChatInput({
  onSend,
  onStop,
  isStreaming,
  placeholder,
  models = [],
  selectedModel = "",
  brandName,
  onOpenModelPicker,
}: ChatInputProps) {
  const [value, setValue] = useState("")
  const [images, setImages] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleInput = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    const ta = e.target
    ta.style.height = "auto"
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, 112), 220)}px`
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if ((!trimmed && images.length === 0) || isStreaming) return
    onSend(trimmed, images)
    setValue("")
    setImages([])
    if (textareaRef.current) {
      textareaRef.current.style.height = "112px"
    }
  }, [value, images, isStreaming, onSend])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const addImages = useCallback((files: FileList | null) => {
    if (!files) return
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"))
    if (imageFiles.length > 0) {
      setImages((prev) => [...prev, ...imageFiles].slice(0, 5))
    }
  }, [])

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData.files
    if (files && files.length > 0) {
      addImages(files)
    }
  }, [addImages])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    addImages(e.dataTransfer.files)
  }, [addImages])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const imageUrls = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images])
  useEffect(() => {
    return () => {
      imageUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [imageUrls])

  const canPickModel = Boolean(onOpenModelPicker) && models.length > 0
  const canSend = Boolean(value.trim()) || images.length > 0

  return (
    <div
      className={`border-t bg-background p-3 transition-colors ${isDragging ? "bg-primary/5" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div
        className={`mx-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-background shadow-sm transition-colors ${
          isDragging ? "border-primary/50 ring-1 ring-primary/30" : "border-border"
        }`}
      >
        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b bg-muted/20 px-3 py-2">
            {images.map((file, i) => (
              <div key={`${file.name}-${i}`} className="relative shrink-0 rounded-md border bg-background p-1">
                <img
                  src={imageUrls[i]}
                  alt={file.name}
                  className="h-16 w-16 rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  title="移除图片"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder ?? "输入消息，Enter 发送，Shift+Enter 换行。支持粘贴或拖拽图片。"}
          disabled={isStreaming}
          rows={4}
          className="min-h-28 w-full resize-none border-0 bg-transparent px-3 py-3 text-sm leading-6 placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          style={{ height: "112px", maxHeight: "220px", overflowY: "auto" }}
        />

        <div className="flex min-h-11 items-center justify-between gap-2 border-t bg-muted/20 px-2 py-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addImages(e.target.files)
                if (fileInputRef.current) fileInputRef.current.value = ""
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              title="添加图片"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {(models.length > 0 || onOpenModelPicker) && (
              <button
                type="button"
                className="flex h-8 max-w-[180px] shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 text-left text-xs outline-none transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-[240px]"
                disabled={isStreaming || !canPickModel}
                title={`${brandName ? `${brandName} · ` : ""}${selectedModel || "选择模型"}`}
                onClick={onOpenModelPicker}
              >
                <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate">{selectedModel || "选择模型"}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            )}
          </div>

          {isStreaming ? (
            <Button
              variant="destructive"
              size="icon"
              onClick={onStop}
              className="h-8 w-8 shrink-0"
              title="停止生成"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className="h-8 w-8 shrink-0"
              title="发送消息"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
