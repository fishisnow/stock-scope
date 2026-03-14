"use client"

import { X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth-context"

interface GoogleLoginPromptProps {
  open: boolean
  onClose: () => void
}

export function GoogleLoginPrompt({ open, onClose }: GoogleLoginPromptProps) {
  const t = useTranslations("auth")
  const { loginWithGoogle } = useAuth()

  if (!open) {
    return null
  }

  const handleContinue = async () => {
    try {
      await loginWithGoogle()
    } catch (error) {
      console.error("Google login failed:", error)
    }
  }

  return (
    <div className="fixed right-4 top-4 z-[70] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-background shadow-2xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full border text-sm font-semibold">
            G
          </div>
          <p className="text-sm font-medium">{t("googlePromptTitle")}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t("closePrompt")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="text-base font-semibold">{t("googlePromptHeading")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("googlePromptDescription")}</p>
        </div>

        <Button className="w-full h-11 text-base" onClick={handleContinue}>
          {t("continueWithGoogle")}
        </Button>

        <p className="text-xs leading-5 text-muted-foreground">
          {t("googlePromptPrivacyNote")}
        </p>
      </div>
    </div>
  )
}

