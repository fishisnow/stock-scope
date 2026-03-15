"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Header } from "@/components/header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import { usePathname, useRouter } from "@/i18n/routing"
import { useLocale, useTranslations } from "next-intl"
import { Clock3, Loader2, Lock, Send, Sparkles } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"
const PAGE_SIZE = 10

interface BriefingRecord {
  id: number
  publisher: string
  published_at: string
  content: string | null
  is_masked?: boolean
  created_at?: string
  updated_at?: string
}

function RobotAvatar() {
  return (
    <svg viewBox="0 0 64 64" className="h-9 w-9" aria-hidden="true">
      <defs>
        <linearGradient id="robotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#robotGradient)" />
      <rect x="17" y="18" width="30" height="26" rx="6" fill="#ffffff" />
      <rect x="22" y="24" width="8" height="8" rx="4" fill="#2563eb" />
      <rect x="34" y="24" width="8" height="8" rx="4" fill="#2563eb" />
      <rect x="23" y="36" width="18" height="4" rx="2" fill="#93c5fd" />
      <rect x="29" y="12" width="6" height="7" rx="3" fill="#ffffff" />
      <circle cx="32" cy="11" r="3" fill="#22c55e" />
    </svg>
  )
}

export default function BriefingPage() {
  const t = useTranslations("briefing")
  const locale = useLocale()
  const { session, user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [records, setRecords] = useState<BriefingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const nextPageRef = useRef(1)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  const loadBriefings = useCallback(
    async (pageToLoad: number, append: boolean) => {
      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
      }

      try {
        const headers: Record<string, string> = {}
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`
        }
        const response = await fetch(`${API_URL}/api/briefings?page=${pageToLoad}&limit=${PAGE_SIZE}`, { headers })
        if (response.status === 401) {
          await logout()
          const currentPath = pathname || "/"
          router.push(`${currentPath}?login=true`)
          window.dispatchEvent(new CustomEvent("openLoginDialog"))
          return
        }
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || t("loadFailed"))
        }

        const list: BriefingRecord[] = Array.isArray(result.data) ? result.data : []
        const pagination = result.pagination || {}
        setRecords((prev) => (append ? [...prev, ...list] : list))
        setHasMore(Boolean(pagination.has_more))
        nextPageRef.current = pageToLoad + 1
        setError(null)
      } catch (err) {
        setError((err as Error).message || t("loadFailed"))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [logout, pathname, router, session?.access_token, t]
  )

  useEffect(() => {
    nextPageRef.current = 1
    void loadBriefings(1, false)
  }, [loadBriefings])

  useEffect(() => {
    if (!sentinelRef.current || !chatScrollRef.current || !hasMore || loading || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first?.isIntersecting && hasMore && !loading && !loadingMore) {
          void loadBriefings(nextPageRef.current, true)
        }
      },
      { root: chatScrollRef.current, rootMargin: "180px 0px" }
    )

    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore, loadBriefings])

  const formatPublishedTime = (value: string) => {
    const date = new Date(value)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
    const dayDiff = Math.round((todayStart - targetStart) / (24 * 60 * 60 * 1000))
    const timePart = date.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })

    if (dayDiff === 0) return `${t("today")} ${timePart}`
    if (dayDiff === 1) return `${t("yesterday")} ${timePart}`

    const datePart = date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    return `${datePart} ${timePart}`
  }

  const openLogin = () => {
    const currentPath = pathname || "/"
    router.push(`${currentPath}?login=true`)
    window.dispatchEvent(new CustomEvent("openLoginDialog"))
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="page-shell py-6 h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
        <div className="text-center mb-2 shrink-0">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t("badge")}</span>
          </div>
          <p className="-mt-3 text-xs sm:text-sm text-muted-foreground">{t("disclaimer")}</p>
        </div>

        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-border bg-secondary/35 p-2 sm:p-3 flex-1 min-h-0 flex flex-col">
          <section ref={chatScrollRef} className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="flex justify-end items-start gap-2">
              <div
                className="max-w-[85%] rounded-xl border border-slate-300 px-3 py-2 text-sm text-foreground"
                style={{ backgroundColor: "rgb(235,236,237)" }}
              >
                <span className="whitespace-pre-wrap">{t("viewerBubble")}</span>
              </div>
              <div className="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-blue-500/90 text-white text-xs font-semibold grid place-items-center">
                {t("meLabel")}
              </div>
            </div>

            {loading && (
              <Card>
                <CardContent className="py-8">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t("loading")}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {!loading && error && (
              <Card className="border-destructive/40">
                <CardContent className="py-6 text-destructive text-sm">{error}</CardContent>
              </Card>
            )}

            {!loading && !error && records.length === 0 && (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">{t("empty")}</CardContent>
              </Card>
            )}

            {records.map((item) => {
              const isItemMasked = Boolean(item.is_masked)
              const shouldPromptLogin = isItemMasked && !user
              return (
              <div key={item.id} className="flex items-start gap-3">
                <div className="mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-primary/20">
                  <RobotAvatar />
                </div>
                <div
                  className={`w-full rounded-xl border border-border/70 bg-background/90 px-3 py-2.5 transition ${
                    shouldPromptLogin ? "cursor-pointer hover:border-primary/45 hover:bg-background" : ""
                  }`}
                  onClick={shouldPromptLogin ? openLogin : undefined}
                  role={shouldPromptLogin ? "button" : undefined}
                  tabIndex={shouldPromptLogin ? 0 : undefined}
                  onKeyDown={
                    shouldPromptLogin
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            openLogin()
                          }
                        }
                      : undefined
                  }
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{item.publisher || t("defaultPublisher")}</span>
                    <span>·</span>
                    <Clock3 className="h-3.5 w-3.5" />
                    <span className="text-xs sm:text-sm font-mono text-muted-foreground">{formatPublishedTime(item.published_at)}</span>
                  </div>
                  <div
                    className="mt-1 rounded-xl border border-slate-300 px-4 py-3"
                    style={{ backgroundColor: "rgb(235,236,237)" }}
                  >
                    {isItemMasked ? (
                      <CardDescription className="text-sm leading-6 whitespace-pre-wrap text-foreground/85 opacity-80 blur-[1.4px] select-none">
                        {item.content || ""}
                      </CardDescription>
                    ) : (
                      <CardDescription className="text-sm leading-6 whitespace-pre-wrap text-foreground/95 transition">
                        {item.content || ""}
                      </CardDescription>
                    )}
                    {shouldPromptLogin && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        <span>{t("maskedHint")}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              )
            })}

            <div ref={sentinelRef} className="h-2 w-full" />
            {loadingMore && (
              <div className="py-3 text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t("loadingMore")}</span>
              </div>
            )}
            {!hasMore && records.length > 0 && (
              <div className="py-2 text-center text-xs text-muted-foreground">{t("historyEnd")}</div>
            )}
          </section>

          <div className="shrink-0 mt-2 rounded-xl border border-border/70 bg-background/90 px-2 py-2">
            <div className="flex items-center gap-2">
              <input
                value=""
                readOnly
                placeholder=""
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-muted-foreground outline-none"
              />
              <button
                type="button"
                disabled
                aria-label={t("sendDisabled")}
                className="h-9 w-9 shrink-0 rounded-md border border-border bg-secondary text-muted-foreground grid place-items-center"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
