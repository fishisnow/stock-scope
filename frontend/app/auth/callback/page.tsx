"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

function getSafeRedirect(value: string | null) {
  if (!value) return "/"
  return value.startsWith("/") ? value : "/"
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return "/"
    const params = new URLSearchParams(window.location.search)
    return getSafeRedirect(params.get("redirectTo") || params.get("next"))
  }, [])

  useEffect(() => {
    const finalizeAuth = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else {
          const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""))
          const accessToken = hashParams.get("access_token")
          const refreshToken = hashParams.get("refresh_token")
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            })
            if (error) throw error
          }
        }
        router.replace(redirectTo)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "确认邮箱失败，请稍后重试"
        setErrorMessage(message)
      }
    }

    finalizeAuth()
  }, [redirectTo, router])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold">正在确认邮箱</h1>
      {errorMessage ? (
        <p className="text-sm text-red-500">{errorMessage}</p>
      ) : (
        <p className="text-sm text-muted-foreground">登录完成后会自动跳转</p>
      )}
      {errorMessage ? (
        <button
          className="text-sm text-blue-600 underline"
          onClick={() => router.replace(redirectTo)}
        >
          返回首页
        </button>
      ) : null}
    </div>
  )
}

