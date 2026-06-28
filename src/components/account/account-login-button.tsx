import { useState } from "react"
import { LogIn, UserCircle2 } from "lucide-react"
import { useWikiStore } from "@/stores/wiki-store"
import { getBrand } from "@/lib/brands"
import { AccountLoginDialog } from "./account-login-dialog"

/**
 * Bottom-left account entry (mirrors HuanXing-Hermes' AccountLoginButton).
 * Logged-out: a "登录" button. Logged-in: the account name + brand, click to
 * manage (switch model / log out). Opens {@link AccountLoginDialog}.
 */
export function AccountLoginButton() {
  const [open, setOpen] = useState(false)
  const brandAuth = useWikiStore((s) => s.brandAuth)

  const rowBase =
    "flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-sm transition-colors text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"

  return (
    <>
      {brandAuth.loggedIn ? (
        <button onClick={() => setOpen(true)} className={rowBase} title={`${getBrand(brandAuth.brandId).name} · ${brandAuth.username}`}>
          <UserCircle2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 truncate text-left">{brandAuth.username || "已登录"}</span>
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className={rowBase}>
          <LogIn className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">登录账号</span>
        </button>
      )}
      <AccountLoginDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
