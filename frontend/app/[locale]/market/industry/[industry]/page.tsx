"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowDown, ArrowLeft, ArrowUp, TrendingDown, TrendingUp } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

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

type SortKey = "amount" | "changeRatio" | "volume" | "volumeRatio" | "turnoverRate" | "pe"
type SortDirection = "asc" | "desc"

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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="py-3 px-2 text-left text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  {t("table.rank")}
                </th>
                <th className="py-3 px-2 text-left text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground min-w-[80px]">
                  {t("table.stock")}
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden sm:table-cell">
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
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                  <button type="button" onClick={() => handleSort("volume")} className="inline-flex items-center gap-1 hover:text-primary">
                    {t("table.volume")}
                    {renderSortIcon("volume")}
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden xl:table-cell">
                  <button type="button" onClick={() => handleSort("volumeRatio")} className="inline-flex items-center gap-1 hover:text-primary">
                    {t("table.volumeRatio")}
                    {renderSortIcon("volumeRatio")}
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden md:table-cell">
                  <button type="button" onClick={() => handleSort("turnoverRate")} className="inline-flex items-center gap-1 hover:text-primary">
                    {t("table.turnover")}
                    {renderSortIcon("turnoverRate")}
                  </button>
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden lg:table-cell">
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
                      <span className="text-xs sm:text-sm font-semibold truncate block max-w-[120px]">{stock.name || "-"}</span>
                    </td>
                    <td className="py-3 px-2 text-right hidden sm:table-cell">
                      <span className="text-xs sm:text-sm font-mono font-medium">
                        {(parseFloat(String(stock.amount || 0)) / 100000000).toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isPositive && <TrendingUp className="h-3 w-3 text-red-600 hidden sm:inline" />}
                        {isNegative && <TrendingDown className="h-3 w-3 text-green-600 hidden sm:inline" />}
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
                    <td className="py-3 px-2 text-right hidden lg:table-cell">
                      <span className="text-xs sm:text-sm font-mono">{(parseFloat(String(stock.volume || 0)) / 10000).toFixed(1)}</span>
                    </td>
                    <td className="py-3 px-2 text-right hidden xl:table-cell">
                      <span className="text-xs sm:text-sm font-mono">{parseFloat(String(stock.volumeRatio || 0)).toFixed(1)}</span>
                    </td>
                    <td className="py-3 px-2 text-right hidden md:table-cell">
                      <span className="text-xs sm:text-sm font-mono">{parseFloat(String(stock.turnoverRate || 0)).toFixed(1)}%</span>
                    </td>
                    <td className="py-3 px-2 text-right hidden lg:table-cell">
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
  const industryParam = (params?.industry as string) || ""
  const industry = useMemo(() => decodeURIComponent(industryParam), [industryParam])
  const industryLabel = useMemo(() => getLocalizedIndustryName(industry, locale), [industry, locale])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<IndustryStocksData | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!industry) {
        setError(t("errors.failedToLoadData"))
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(
          `${API_URL}/api/market_breadth/industry_stocks?industry=${encodeURIComponent(industry)}`
        )
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        } else {
          setError(`${t("errors.failedToLoadData")}: ${result.error}`)
        }
      } catch (err) {
        setError(`${t("errors.networkError")}: ${(err as Error).message}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [industry, t])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-7xl">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="font-serif text-4xl sm:text-5xl tracking-tight text-primary">
                {industryLabel || "-"}
              </h1>
              {!loading && !error && data && (
                <span className="text-sm sm:text-base font-mono tabular-nums text-muted-foreground">
                  {t("breadth.industryCountInline", { count: data.total_candidates })}
                </span>
              )}
            </div>
          </div>
          <Button asChild variant="outline" className="gap-2 shrink-0 self-start sm:self-auto">
            <Link href="/market">
              <ArrowLeft className="h-4 w-4" />
              {t("breadth.backToMarket")}
            </Link>
          </Button>
        </div>

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
