"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowLeft, ArrowUp, TrendingDown, TrendingUp } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Area, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Header } from "@/components/header"
import { Link } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getLocalizedIndustryName } from "@/lib/industry-labels"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

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
  t: any
}) {
  const [showAll, setShowAll] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("amount")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const sortedData = useMemo(() => {
    const toNumber = (value: string | number | undefined) => {
      const n = parseFloat(String(value ?? 0))
      return Number.isFinite(n) ? n : 0
    }
    return [...data].sort((a, b) => {
      const aValue = toNumber(a[sortKey] as string | number | undefined)
      const bValue = toNumber(b[sortKey] as string | number | undefined)
      if (sortDirection === "asc") return aValue - bValue
      return bValue - aValue
    })
  }, [data, sortDirection, sortKey])
  const displayData = showAll ? sortedData : sortedData.slice(0, 8)
  const hasMore = data.length > 8

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
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardContent className="pt-6">
        <div className="mb-4 flex justify-end">
          <Badge variant="secondary" className="text-sm font-mono">
            {data.length} {t("table.stocks")}
          </Badge>
        </div>
        <div className="overflow-x-auto [touch-action:pan-x] [-webkit-overflow-scrolling:touch] mobile-fit-table-wrapper">
          <table className="w-full mobile-fit-table">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="py-3 px-2 text-left text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  {t("table.rank")}
                </th>
                <th className="py-3 px-2 text-left text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground min-w-[80px]">
                  {t("table.stock")}
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

        {hasMore && (
          <div className="mt-6 text-center">
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
  const params = useParams()
  const searchParams = useSearchParams()
  const industryParam = (params?.industry as string) || ""
  const industry = useMemo(() => decodeURIComponent(industryParam), [industryParam])
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
          fetch(`${API_URL}/api/market_breadth/industry_stocks?industry=${encodeURIComponent(industry)}`),
          fetch(`${API_URL}/api/market_breadth?limit=30&breadth_type=industry&sector=${encodeURIComponent(industry)}`),
        ])
        const stocksResult = await stocksResponse.json()
        if (stocksResult.success) {
          setData(stocksResult.data)
        } else {
          setError(`${t("errors.failedToLoadData")}: ${stocksResult.error}`)
        }

        const breadthResult = await breadthResponse.json()
        if (breadthResult.success) {
          const breadthData = breadthResult.data as MarketBreadthData
          const seriesByDate = new Map<string, number>()
          for (const item of breadthData.records || []) {
            if (item.breadth_type !== "industry") continue
            const value = parseBreadthIndex(item.breadth_pct)
            if (value === null) continue
            seriesByDate.set(item.date, value)
          }
          const points = (breadthData.dates || [])
            .slice()
            .reverse()
            .map((date) => ({ date, value: seriesByDate.get(date) }))
            .filter((item): item is { date: string; value: number } => Number.isFinite(item.value))
          setBreadthSeries(points)
        } else {
          setBreadthSeries([])
        }
      } catch (err) {
        setError(`${t("errors.networkError")}: ${(err as Error).message}`)
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
      <main className="page-shell page-main-spacing">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl tracking-tight text-primary">
                {industryLabel || "-"}
              </h1>
              {!loading && !error && data && (
                <span className="text-sm sm:text-base font-mono tabular-nums text-muted-foreground">
                  {t("breadth.industryCountInline", { count: data.total_candidates })}
                </span>
              )}
            </div>
            {breadthValue !== null && (
              <div className="mt-3 inline-flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("breadth.currentIndustryBreadth")}</span>
                <span
                  className={`px-2 py-0.5 rounded text-sm font-mono ${getBreadthTextColor(breadthValue)}`}
                  style={{ backgroundColor: getBreadthColor(breadthValue) }}
                >
                  {formatBreadthIndex(breadthValue, 1)}
                </span>
                {breadthDate && <span className="text-xs text-muted-foreground font-mono">{breadthDate}</span>}
              </div>
            )}
          </div>
          <Button asChild variant="outline" className="gap-2 shrink-0 self-start sm:self-auto">
            <Link href="/market">
              <ArrowLeft className="h-4 w-4" />
              {t("breadth.backToMarket")}
            </Link>
          </Button>
        </div>

        {(breadthSeriesLoading || breadthSeries.length > 0) && (
          <Card className="mb-6">
            <CardContent className="pt-5 pb-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t("breadth.currentIndustryBreadth")}</span>
                {breadthSeries.length > 0 && (
                  <span className="text-xs font-mono text-muted-foreground rounded bg-secondary/60 px-2 py-0.5">
                    {breadthSeries[0]?.date} ~ {breadthSeries[breadthSeries.length - 1]?.date}
                  </span>
                )}
              </div>
              <div className="h-44 w-full">
                {breadthSeriesLoading ? (
                  <div className="h-full w-full animate-pulse rounded-md bg-secondary/50" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={breadthSeries} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border) / 0.35)" />
                      <XAxis
                        dataKey="date"
                        minTickGap={24}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickFormatter={(value) => String(value).slice(5)}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 20, 40, 60, 80, 100]}
                        width={36}
                        tickFormatter={(value) => `${value}`}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <ReferenceLine
                        y={50}
                        stroke="#f59e0b"
                        strokeDasharray="6 6"
                        strokeOpacity={0.9}
                        ifOverflow="visible"
                      />
                      <Tooltip
                        formatter={(value: number) => formatBreadthIndex(Number(value), 1)}
                        labelFormatter={(label) => String(label)}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "11px",
                          padding: "8px 10px",
                          boxShadow: "0 8px 20px rgba(2, 6, 23, 0.14)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="none"
                        fill="#2563eb"
                        fillOpacity={0.12}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#2563eb"
                        strokeWidth={2.5}
                        dot={{ r: 2, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 1 }}
                        activeDot={{ r: 5, fill: "#2563eb", stroke: "#ffffff", strokeWidth: 2 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {loading && <div className="text-sm text-muted-foreground">{t("breadth.industryStocksLoading")}</div>}

        {!loading && error && (
          <Card className="border-destructive bg-destructive/5">
            <CardContent className="py-8">
              <div className="text-center text-destructive">
                <p className="font-semibold mb-2">{t("errors.errorLoadingData")}</p>
                <p className="text-sm">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && data && (
          <>
            {data.stocks.length > 0 ? (
              <StockTable
                data={data.stocks}
                t={t}
              />
            ) : (
              <div className="text-sm text-muted-foreground">{t("breadth.industryStocksNoData")}</div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
