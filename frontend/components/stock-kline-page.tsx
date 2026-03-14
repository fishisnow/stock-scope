"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { KLineChart, CandleData } from "@/components/kline-chart"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

const formatDate = (value: Date) => value.toISOString().slice(0, 10)

interface StockKLinePageProps {
  code: string
  market: string
  name?: string
}

export function StockKLinePage({ code, market, name }: StockKLinePageProps) {
  const t = useTranslations("stock")
  const router = useRouter()
  const normalizedMarket = market.toUpperCase() === "HK" ? "HK" : "A"

  const today = useMemo(() => new Date(), [])
  const defaultStart = useMemo(() => {
    const date = new Date()
    date.setFullYear(date.getFullYear() - 1)
    return date
  }, [])

  const [startDate, setStartDate] = useState(formatDate(defaultStart))
  const [endDate, setEndDate] = useState(formatDate(today))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CandleData[]>([])
  const [klineType, setKlineType] = useState("K_DAY")
  const [chartHeight, setChartHeight] = useState(520)
  const [isMobile, setIsMobile] = useState(false)
  const lastRequestKeyRef = useRef<string | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  const getRangeByType = useCallback((type: string) => {
    const now = new Date()
    const start = new Date(now)
    // 长期趋势带需要至少90个数据点才能计算EMA(90)
    // 为了保证数据充足，我们需要获取更多的历史数据
    if (type === "K_RT") {
      // 分时：默认取近24小时（按日期查询）
      start.setDate(start.getDate() - 1)
    } else if (type === "K_WEEK") {
      // 周K：至少需要90周 ≈ 1.73年，取3年保证数据充足
      start.setFullYear(start.getFullYear() - 3)
    } else if (type === "K_MON") {
      // 月K：至少需要90个月 ≈ 7.5年，取10年保证数据充足
      start.setFullYear(start.getFullYear() - 10)
    } else if (type === "K_QUARTER") {
      // 季K：至少需要90个季度 ≈ 22.5年，取25年保证数据充足
      start.setFullYear(start.getFullYear() - 25)
    } else if (type === "K_YEAR") {
      // 年K：从2000年开始查询（避免接口报错，且覆盖大部分有效数据）
      start.setFullYear(2000, 0, 1)
    } else {
      // 日K：至少需要90天，取1年保证数据充足
      start.setFullYear(start.getFullYear() - 1)
    }
    return { start: formatDate(start), end: formatDate(now) }
  }, [])

  const fetchKline = useCallback(
    async (
      override?: { start?: string; end?: string; ktype?: string; force?: boolean }
    ) => {
    if (!code) return
    const queryStart = override?.start ?? startDate
    const queryEnd = override?.end ?? endDate
    const queryType = override?.ktype ?? klineType
    const requestKey = `${code}-${normalizedMarket}-${queryStart}-${queryEnd}-${queryType}`
    if (!override?.force && lastRequestKeyRef.current === requestKey) {
      return
    }
    lastRequestKeyRef.current = requestKey
    setLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({
        code,
        market: normalizedMarket,
        start: queryStart,
        end: queryEnd,
        ktype: queryType,
      })
      const response = await fetch(`${API_URL}/api/stock-analysis/kline-history?${query.toString()}`)
      if (!response.ok) {
        throw new Error(`${t("loadFailed")}`)
      }
      const result = await response.json()
      if (!result?.success) {
        throw new Error(result?.error || t("loadFailed"))
      }
      setData(result.data || [])
    } catch (err: any) {
      setError(err?.message || t("loadFailed"))
      setData([])
    } finally {
      setLoading(false)
    }
  },
    [code, normalizedMarket, t, startDate, endDate, klineType]
  )

  useEffect(() => {
    const nextRange = getRangeByType(klineType)
    setStartDate(nextRange.start)
    setEndDate(nextRange.end)
    fetchKline({ start: nextRange.start, end: nextRange.end, ktype: klineType })
  }, [getRangeByType, klineType, fetchKline])

  useEffect(() => {
    if (typeof window === "undefined") return
    const media = window.matchMedia("(max-width: 640px)")
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener("change", sync)
    return () => media.removeEventListener("change", sync)
  }, [])

  useEffect(() => {
    if (!chartContainerRef.current) return
    const element = chartContainerRef.current
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const nextHeight = Math.max(isMobile ? 520 : 700, Math.floor(entry.contentRect.height))
      setChartHeight(nextHeight)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [isMobile])

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
      return
    }
    router.push("/market")
  }, [router])

  return (
    <section className="section-shell">
      <div className="container mx-auto max-w-6xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-3xl font-semibold leading-tight break-words">
              {normalizedMarket === "HK" ? "🇭🇰" : "🇨🇳"} {code} {name ?? ""}
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            type="button"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Button>
        </div>

        <div
          ref={chartContainerRef}
          className="rounded-lg border bg-card p-2 sm:p-3"
          style={{ height: isMobile ? "calc(100vh - 150px)" : "calc(100vh - 220px)", minHeight: isMobile ? 620 : 720 }}
        >
          <KLineChart
            data={data}
            symbol={`${normalizedMarket}.${code}`}
            height={Math.max(isMobile ? 600 : 680, chartHeight - (isMobile ? 8 : 12))}
            klineType={klineType}
            onKlineTypeChange={setKlineType}
            onRefresh={() => fetchKline({ force: true })}
          />
          {error ? <div className="px-2 pt-2 text-sm text-destructive">{error}</div> : null}
        </div>
      </div>
    </section>
  )
}

