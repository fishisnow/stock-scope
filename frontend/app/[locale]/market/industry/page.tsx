"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowDown, ArrowLeft, ArrowUp, TrendingDown, TrendingUp } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Area, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Header } from "@/components/header"
import { Link } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getLocalizedIndustryName } from "@/lib/industry-labels"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api"

interface Stock {
  name: string
  code?: string
  exchange?: string
  changeRatio: string | number
  volume: string | number
  volumeRatio: string | number
  turnoverRate: string | number
  pe: string | number
  amount?: string | number
}

interface IndustryStocksData {
  industry: string
  stocks: Stock[]
  total_candidates: number
  selected_count: number
}

interface MarketBreadthRecord {
  date: string
  breadth_type: string
  sector: string
  breadth_pct: string | number
}

interface MarketBreadthData {
  dates: string[]
  records: MarketBreadthRecord[]
}

type SortKey = "amount" | "changeRatio" | "volume" | "volumeRatio" | "turnoverRate" | "pe"
type SortDirection = "asc" | "desc"

const parseBreadthIndex = (value: string | number | null | undefined): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value !== "string") return null
  const parsed = parseFloat(value.replace("%", "").trim())
  return Number.isFinite(parsed) ? parsed : null
}

function buildFutuStockUrl(code?: string, exchange?: string) {
  const normalizedCode = String(code || "").trim()
  if (!normalizedCode) return null

  const normalizedExchange = String(exchange || "").trim().toUpperCase()
  const market = normalizedExchange || (
    normalizedCode.startsWith("6")
      ? "SH"
      : normalizedCode.startsWith("0") || normalizedCode.startsWith("2") || normalizedCode.startsWith("3")
        ? "SZ"
        : normalizedCode.startsWith("4") || normalizedCode.startsWith("8")
          ? "BJ"
          : "SH"
  )

  return `https://www.futunn.com/stock/${normalizedCode}-${market}`
}

function StockTable({
  data,
  t,
}: {
  data: Stock[]
  t: ReturnType<typeof useTranslations>
}) {
  const [showAll, setShowAll] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("amount")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const displayData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const aValue = parseFloat(String(a[sortKey] || 0))
      const bValue = parseFloat(String(b[sortKey] || 0))
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    })
    return showAll ? sorted : sorted.slice(0, 20)
  }, [data, showAll, sortDirection, sortKey])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"))
      return
    }
    setSortKey(key)
    setSortDirection("desc")
  }

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return null
    return sortDirection === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
  }

  return (
    <Card>
      <CardContent className="p-0 sm:p-2">
        <div className="overflow-x-auto [touch-action:pan-x] [-webkit-overflow-scrolling:touch] mobile-fit-table-wrapper">
          <table className="w-full mobile-fit-table">
            <thead>
              <tr className="border-b border-border/50 bg-muted/20">
                <th className="py-3 px-2 text-left text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  {t("table.rank")}
                </th>
                <th className="py-3 px-2 text-left text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground min-w-[80px]">
                  {t("table.name")}
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  <button type="button" onClick={() => handleSort("amount")} className="inline-flex items-center gap-1 hover:text-primary">
                    {t("table.amount")}
                    {renderSortIcon("amount")}
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  <button type="button" onClick={() => handleSort("changeRatio")} className="inline-flex items-center gap-1 hover:text-primary">
                    {t("table.change")}
                    {renderSortIcon("changeRatio")}
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  <button type="button" onClick={() => handleSort("volume")} className="inline-flex items-center gap-1 hover:text-primary">
                    {t("table.volume")}
                    {renderSortIcon("volume")}
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  <button type="button" onClick={() => handleSort("volumeRatio")} className="inline-flex items-center gap-1 hover:text-primary">
                    {t("table.volumeRatio")}
                    {renderSortIcon("volumeRatio")}
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  <button type="button" onClick={() => handleSort("turnoverRate")} className="inline-flex items-center gap-1 hover:text-primary">
                    {t("table.turnover")}
                    {renderSortIcon("turnoverRate")}
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  <button type="button" onClick={() => handleSort("pe")} className="inline-flex items-center gap-1 hover:text-primary">
                    {t("table.pe")}
                    {renderSortIcon("pe")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((stock, index) => {
                const changeRatio = parseFloat(String(stock.changeRatio || 0))
                const isPositive = changeRatio > 0
                const isNegative = changeRatio < 0
                const isTopThree = index < 3
                const stockLink = buildFutuStockUrl(stock.code, stock.exchange)

                return (
                  <tr
                    key={`${stock.code || stock.name}-${index}`}
                    className={`border-b border-border/40 hover:bg-secondary/30 transition-colors ${
                      isTopThree ? "bg-secondary/10" : ""
                    }`}
                  >
                    <td className="py-3 px-2">
                      <span className={`text-xs sm:text-sm font-bold ${isTopThree ? "text-primary" : "text-muted-foreground"}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      {stockLink ? (
                        <a
                          href={stockLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs sm:text-sm font-semibold truncate block max-w-[120px] text-primary hover:underline"
                        >
                          {stock.name || "-"}
                        </a>
                      ) : (
                        <span className="text-xs sm:text-sm font-semibold truncate block max-w-[120px]">{stock.name || "-"}</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-xs sm:text-sm font-mono font-medium">
                        {(parseFloat(String(stock.amount || 0)) / 100000000).toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isPositive && <TrendingUp className="h-3 w-3 text-red-600" />}
                        {isNegative && <TrendingDown className="h-3 w-3 text-green-600" />}
                        <span
                          className={`text-xs sm:text-sm font-mono font-bold whitespace-nowrap ${
                            isPositive ? "text-red-600" : isNegative ? "text-green-600" : "text-muted-foreground"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {changeRatio.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-xs sm:text-sm font-mono">{(parseFloat(String(stock.volume || 0)) / 10000).toFixed(1)}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-xs sm:text-sm font-mono">{parseFloat(String(stock.volumeRatio || 0)).toFixed(1)}</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-xs sm:text-sm font-mono">{parseFloat(String(stock.turnoverRate || 0)).toFixed(1)}%</span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className="text-xs sm:text-sm font-mono">{parseFloat(String(stock.pe || 0)).toFixed(1)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {data.length > 20 && (
          <div className="mt-6 text-center pb-4">
            <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? t("table.showLess") : t("table.showAll", { count: data.length })}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function IndustryStocksPage() {
  const t = useTranslations("market")
  const locale = useLocale()
  const searchParams = useSearchParams()
  const industry = searchParams.get("industry") || ""
  const industryLabel = useMemo(() => getLocalizedIndustryName(industry, locale), [industry, locale])
  const breadthValue = useMemo(() => {
    const raw = searchParams.get("breadth")
    if (!raw) return null
    const parsed = parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : null
  }, [searchParams])
  const breadthDate = searchParams.get("breadthDate") || ""

  const getBreadthColor = (value: number | null) => {
    if (value === null) return "transparent"
    const clamped = Math.max(0, Math.min(100, value))
    const linear = Math.abs(clamped - 50) / 50
    const ratio = Math.pow(linear, 0.65)
    const r = clamped >= 50 ? Math.round(255 - ratio * (255 - 207)) : Math.round(255 - ratio * (255 - 0))
    const g = clamped >= 50 ? Math.round(255 - ratio * (255 - 42)) : Math.round(255 - ratio * (255 - 135))
    const b = clamped >= 50 ? Math.round(255 - ratio * (255 - 42)) : Math.round(255 - ratio * (255 - 58))
    return `rgb(${r}, ${g}, ${b})`
  }

  const getBreadthTextColor = (value: number | null) => {
    if (value === null) return "text-muted-foreground"
    const linear = Math.abs(Math.max(0, Math.min(100, value)) - 50) / 50
    const ratio = Math.pow(linear, 0.65)
    return ratio > 0.35 ? "text-white" : "text-slate-900"
  }

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<IndustryStocksData | null>(null)
  const [breadthSeriesLoading, setBreadthSeriesLoading] = useState(true)
  const [breadthSeries, setBreadthSeries] = useState<Array<{ date: string; value: number }>>([])
  const formatBreadthIndex = (value: number | null, digits = 1) => (value === null ? "--" : value.toFixed(digits))

  useEffect(() => {
    const load = async () => {
      if (!industry) {
        setError(t("errors.failedToLoadData"))
        setLoading(false)
        return
      }
      setLoading(true)
      setBreadthSeriesLoading(true)
      setError(null)
      try {
        const [stocksResponse, breadthResponse] = await Promise.all([
          fetch(`${API_URL}/market_breadth/industry_stocks?industry=${encodeURIComponent(industry)}`),
          fetch(`${API_URL}/market_breadth?limit=30&breadth_type=industry&sector=${encodeURIComponent(industry)}`),
        ])
        const stocksResult = await stocksResponse.json()
        if (stocksResult.success) {
          setData(stocksResult.data)
        } else {
          throw new Error(stocksResult.error || t("errors.failedToLoadData"))
        }

        const breadthResult = await breadthResponse.json()
        if (breadthResult.success && Array.isArray(breadthResult.data)) {
          const series = breadthResult.data
            .map((item: MarketBreadthRecord) => ({
              date: item.date,
              value: parseBreadthIndex(item.breadth_pct) ?? 0,
            }))
            .reverse()
          setBreadthSeries(series)
        } else {
          setBreadthSeries([])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t("errors.failedToLoadData"))
      } finally {
        setLoading(false)
        setBreadthSeriesLoading(false)
      }
    }

    load()
  }, [industry, t])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/market">
              <ArrowLeft className="h-4 w-4" />
              {t("detail.backToMarket")}
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-serif text-primary sm:text-3xl">{industryLabel || t("detail.industryDetail")}</h1>
            <p className="text-sm text-muted-foreground">{t("detail.industryDetailDesc")}</p>
          </div>
        </div>

        {breadthValue !== null && (
          <Card className="mb-6 border-border/60">
            <CardContent className="flex flex-wrap items-center gap-4 p-5">
              <Badge
                className={`${getBreadthTextColor(breadthValue)}`}
                style={{ backgroundColor: getBreadthColor(breadthValue) }}
              >
                {t("breadth.latestBreadth")}: {formatBreadthIndex(breadthValue)}%
              </Badge>
              {breadthDate && <span className="text-sm text-muted-foreground">{t("breadth.latestDate")}: {breadthDate}</span>}
            </CardContent>
          </Card>
        )}

        <Card className="mb-6 border-border/60">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{t("breadth.trendTitle")}</h2>
                <p className="text-sm text-muted-foreground">{t("breadth.trendDesc")}</p>
              </div>
              {breadthSeries.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {breadthSeries[0]?.date} ~ {breadthSeries[breadthSeries.length - 1]?.date}
                </span>
              )}
            </div>

            <div className="h-[280px] w-full">
              {breadthSeriesLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("loading")}</div>
              ) : breadthSeries.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("errors.failedToLoadData")}</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={breadthSeries} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} minTickGap={24} />
                    <YAxis domain={[0, 100]} ticks={[0, 20, 40, 60, 80, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, t("breadth.latestBreadth")]} />
                    <ReferenceLine y={50} stroke="rgba(148,163,184,0.4)" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="value" fill="rgba(59,130,246,0.12)" stroke="none" />
                    <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">{t("loading")}</div>
        ) : error ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-destructive">{error}</div>
        ) : data ? (
          <StockTable data={data.stocks} t={t} />
        ) : null}
      </main>
    </div>
  )
}
