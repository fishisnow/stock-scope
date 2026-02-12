"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from 'next-intl'
import { Link } from "@/i18n/routing"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

/** 将 "2026-02-13" 格式化为 "02-13 周五" */
function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${mm}-${dd} ${WEEKDAY_LABELS[d.getDay()]}`
}

/** 从日期字符串获取 "YYYY年MM月" 分组标签 */
function getMonthGroup(dateStr: string): string {
  const [year, month] = dateStr.split("-")
  return `${year}年${month}月`
}

/** 将日期列表按月份分组，保持原顺序 */
function groupDatesByMonth(dates: string[]): { label: string; dates: string[] }[] {
  const groups: { label: string; dates: string[] }[] = []
  let currentLabel = ""
  for (const date of dates) {
    const label = getMonthGroup(date)
    if (label !== currentLabel) {
      groups.push({ label, dates: [date] })
      currentLabel = label
    } else {
      groups[groups.length - 1].dates.push(date)
    }
  }
  return groups
}

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

interface MarketData {
  time?: string
  intersection?: Stock[]
  top_change?: Stock[]
  top_turnover?: Stock[]
}

interface FutuData {
  A?: MarketData
  HK?: MarketData
}

interface MarketBreadthRecord {
  date: string
  breadth_type: string
  sector: string
  total_count: number
  above_ma20_count: number
  breadth_pct: number
}

interface MarketBreadthData {
  dates: string[]
  records: MarketBreadthRecord[]
}

const SECTOR_ORDER = [
  "科技",
  "医药",
  "消费",
  "汽车",
  "新能源",
  "军工",
  "原材料",
  "公用事业和基建",
  "金融",
  "交运物流",
]

const INDUSTRY_GROUPS: Array<{ sector: string; industries: string[] }> = [
  { sector: "科技", industries: ["半导体", "消费电子", "光学光电子", "通信设备", "计算机应用", "软件开发", "传媒"] },
  { sector: "医药", industries: ["化学制药", "生物制品", "中药", "医疗器械", "医疗服务"] },
  { sector: "消费", industries: ["食品饮料", "家电"] },
  { sector: "汽车", industries: ["汽车整车", "汽车零部件"] },
  { sector: "新能源", industries: ["锂电池", "光伏", "风电"] },
  { sector: "军工", industries: ["军工"] },
  { sector: "原材料", industries: ["化工", "有色金属", "钢铁", "煤炭"] },
  { sector: "公用事业和基建", industries: ["电力", "环保", "建筑", "房地产"] },
  { sector: "金融", industries: ["银行", "证券", "保险"] },
  { sector: "交运物流", industries: ["物流", "航空", "机场", "港口", "高速", "铁路", "航运"] },
]
const INDUSTRY_ORDER = INDUSTRY_GROUPS.flatMap((group) => group.industries)

const INDEX_OPTIONS = [
  { code: "SH.000906", label: "中证800" },
  { code: "SZ.399102", label: "创业板指" },
  { code: "SH.000688", label: "科创50" },
  { code: "SH.000016", label: "上证50" },
]

// StockTable Component
function StockTable({
  title,
  data,
  dataType,
  marketKey,
  t,
}: {
  title: string
  data: Stock[]
  dataType: string
  marketKey: string
  t: any
}) {
  const [showAll, setShowAll] = useState(false)
  const displayData = showAll ? data : data.slice(0, 8)
  const hasMore = data.length > 8
  const getStockHref = (stock: Stock) => {
    const rawCode = String(stock.code || "").trim()
    if (!rawCode) return ""
    const normalizedCode = rawCode.includes(".") ? rawCode.split(".")[1] : rawCode
    const nameParam = stock.name ? `?name=${encodeURIComponent(stock.name)}` : ""
    return `/stock/${marketKey}/${normalizedCode}${nameParam}`
  }

  return (
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-serif text-primary mb-2">{title}</CardTitle>
            <CardDescription>{t('table.performanceMetrics')}</CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm font-mono">
            {data.length} {t('table.stocks')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="py-3 px-2 text-left text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  {t('table.rank')}
                </th>
                <th className="py-3 px-2 text-left text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground min-w-[80px]">
                  {t('table.stock')}
                </th>
                {(dataType === "top_turnover" || dataType === "intersection") && (
                  <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    {t('table.amount')}
                  </th>
                )}
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  {t('table.change')}
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                  {t('table.volume')}
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden xl:table-cell">
                  {t('table.volumeRatio')}
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden md:table-cell">
                  {t('table.turnover')}
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                  {t('table.pe')}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((stock, index) => {
                const changeRatio = parseFloat(String(stock.changeRatio || 0))
                const isPositive = changeRatio > 0
                const isNegative = changeRatio < 0
                const isTopThree = index < 3

                const stockHref = getStockHref(stock)
                return (
                  <tr
                    key={index}
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
                      {stockHref ? (
                        <Link
                          href={stockHref}
                          className="text-xs sm:text-sm font-semibold truncate block max-w-[120px] text-primary hover:underline"
                          title={stock.name || ""}
                        >
                          {stock.name || "-"}
                        </Link>
                      ) : (
                        <span className="text-xs sm:text-sm font-semibold truncate block max-w-[120px]">
                          {stock.name || "-"}
                        </span>
                      )}
                    </td>
                    {(dataType === "top_turnover" || dataType === "intersection") && (
                      <td className="py-3 px-2 text-right hidden sm:table-cell">
                        <span className="text-xs sm:text-sm font-mono font-medium">
                          {(parseFloat(String(stock.amount || 0)) / 100000000).toFixed(1)}
                        </span>
                      </td>
                    )}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="gap-2"
            >
              {showAll ? (
                <>
                  {t('table.showLess')}
                  <ChevronLeft className="h-4 w-4 rotate-90" />
                </>
              ) : (
                <>
                  {t('table.showAll', { count: data.length })}
                  <ChevronLeft className="h-4 w-4 -rotate-90" />
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function MarketPage() {
  const t = useTranslations('market')
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [futuData, setFutuData] = useState<FutuData | null>(null)
  const [breadthData, setBreadthData] = useState<MarketBreadthData | null>(null)
  const [breadthLoading, setBreadthLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAvailableDates()
    loadBreadthData()
  }, [])

  const loadAvailableDates = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dates`)
      const result = await response.json()

      if (result.success) {
        setAvailableDates(result.data)
        if (result.data.length > 0) {
          setSelectedDate(result.data[0])
          loadData(result.data[0])
        }
      } else {
        setError(t('errors.failedToLoadDates') + ": " + result.error)
      }
    } catch (err) {
      setError(t('errors.networkError') + ": " + (err as Error).message)
    }
  }

  const loadData = async (date: string) => {
    if (!date) {
      setFutuData(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/futu_data/${date}`)
      const result = await response.json()

      if (result.success) {
        setFutuData(result.data)
      } else {
        setError(t('errors.failedToLoadData') + ": " + result.error)
      }
    } catch (err) {
      setError(t('errors.networkError') + ": " + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const loadBreadthData = async () => {
    setBreadthLoading(true)
    try {
      const response = await fetch(`${API_URL}/api/market_breadth?limit=30`)
      const result = await response.json()
      if (result.success) {
        setBreadthData(result.data)
      } else {
        setError(t('errors.failedToLoadData') + ": " + result.error)
      }
    } catch (err) {
      setError(t('errors.networkError') + ": " + (err as Error).message)
    } finally {
      setBreadthLoading(false)
    }
  }

  const getBreadthValue = (date: string, label: string, breadthType?: string) => {
    if (!breadthData) return null
    const record = breadthData.records.find(
      (item) =>
        item.date === date &&
        item.sector === label &&
        (!breadthType || item.breadth_type === breadthType)
    )
    return record ? Number(record.breadth_pct) : null
  }

  const getBreadthColor = (value: number | null) => {
    if (value === null) return "transparent"
    const clamped = Math.max(0, Math.min(100, value))
    const midpoint = 50
    const isHigh = clamped >= midpoint
    const ratio = isHigh ? (clamped - midpoint) / midpoint : (midpoint - clamped) / midpoint
    const lightness = 95 - ratio * 60
    const hue = isHigh ? 0 : 120
    return `hsl(${hue}, 55%, ${lightness}%)`
  }

  const getBreadthTextColor = (value: number | null) => {
    if (value === null) return "text-muted-foreground"
    const clamped = Math.max(0, Math.min(100, value))
    const midpoint = 50
    const isHigh = clamped >= midpoint
    const ratio = isHigh ? (clamped - midpoint) / midpoint : (midpoint - clamped) / midpoint
    const lightness = 95 - ratio * 60
    if (lightness <= 55) return "text-white"
    return "text-slate-900"
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    loadData(date)
  }

  const navigateDate = (direction: "prev" | "next") => {
    const currentIndex = availableDates.indexOf(selectedDate)
    if (currentIndex === -1) return

    if (direction === "prev" && currentIndex < availableDates.length - 1) {
      const newDate = availableDates[currentIndex + 1]
      handleDateChange(newDate)
    } else if (direction === "next" && currentIndex > 0) {
      const newDate = availableDates[currentIndex - 1]
      handleDateChange(newDate)
    }
  }

  const canNavigatePrev = availableDates.indexOf(selectedDate) < availableDates.length - 1
  const canNavigateNext = availableDates.indexOf(selectedDate) > 0

  const renderMarketSection = (marketKey: string, marketData: MarketData, marketTitle: string) => {
    return (
      <div className="space-y-10">
        <div className="text-center mb-10">
          <h2 className="font-serif text-4xl sm:text-5xl text-primary mb-3">{marketTitle}</h2>
          {marketData.time && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">{t('date.lastUpdated')}: {marketData.time}</span>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {/* Featured: High Change & Volume */}
          {marketData.intersection && marketData.intersection.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-1 w-12 bg-primary rounded-full" />
                <h3 className="font-serif text-2xl text-primary">{t('sections.topPerformers')}</h3>
                <div className="h-1 flex-1 bg-primary/20 rounded-full" />
              </div>
              <StockTable
                title={t('sections.highChangeVolume')}
                data={marketData.intersection}
                dataType="intersection"
                marketKey={marketKey}
                t={t}
              />
            </div>
          )}

          {/* Top Gainers and Highest Volume side by side */}
          {((marketData.top_change && marketData.top_change.length > 0) ||
            (marketData.top_turnover && marketData.top_turnover.length > 0)) && (
            <>
              <div className="flex items-center gap-3 my-10">
                <div className="h-1 w-12 bg-primary/60 rounded-full" />
                <h3 className="font-serif text-2xl text-primary">{t('sections.marketLeaders')}</h3>
                <div className="h-1 flex-1 bg-primary/20 rounded-full" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {marketData.top_change && marketData.top_change.length > 0 && (
                  <StockTable
                    title={t('sections.topGainers')}
                    data={marketData.top_change}
                    dataType="top_change"
                    marketKey={marketKey}
                    t={t}
                  />
                )}
                {marketData.top_turnover && marketData.top_turnover.length > 0 && (
                  <StockTable
                    title={t('sections.highestVolume')}
                    data={marketData.top_turnover}
                    dataType="top_turnover"
                    marketKey={marketKey}
                    t={t}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-7xl">
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t('realtimeIntelligence')}</span>
          </div>
          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-primary mb-6">{t('pageTitle')}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('pageSubtitle')}
          </p>
        </div>

        {/* Market Breadth */}
        <div className="mb-16 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-1 w-12 bg-primary rounded-full" />
            <h2 className="font-serif text-3xl text-primary">{t('breadth.title')}</h2>
            <div className="h-1 flex-1 bg-primary/20 rounded-full" />
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t('breadth.subtitle')}</p>
            <p>{t('breadth.thresholdHint')}</p>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-6">
              {breadthLoading && (
                <div className="text-sm text-muted-foreground">{t('breadth.loading')}</div>
              )}
              {!breadthLoading && breadthData && breadthData.dates.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="text-left py-2 px-3 text-muted-foreground whitespace-nowrap border border-border/30">
                          {t('breadth.date')}
                        </th>
                        {INDEX_OPTIONS.map((indexOption) => (
                          <th
                            key={indexOption.code}
                            className="py-2 px-2 text-center text-muted-foreground whitespace-nowrap border border-border/30"
                          >
                            {indexOption.label}
                          </th>
                        ))}
                        {SECTOR_ORDER.map((sector) => (
                          <th
                            key={sector}
                            className="py-2 px-2 text-center text-muted-foreground whitespace-nowrap border border-border/30"
                          >
                            {sector}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {breadthData.dates.map((date) => (
                        <tr key={date} className="border-t border-border/50">
                          <td className="py-2 px-3 text-muted-foreground whitespace-nowrap border border-border/30 bg-background">
                            {date}
                          </td>
                          {INDEX_OPTIONS.map((indexOption) => {
                            const value = getBreadthValue(date, indexOption.label, "index")
                            return (
                              <td
                                key={`${date}-${indexOption.code}`}
                                className={`py-2 px-2 text-center text-xs font-mono border border-border/30 ${getBreadthTextColor(value)}`}
                                style={{ backgroundColor: getBreadthColor(value) }}
                              >
                                {value === null ? "-" : value.toFixed(0)}
                              </td>
                            )
                          })}
                          {SECTOR_ORDER.map((sector) => {
                            const value = getBreadthValue(date, sector, "sector")
                            return (
                              <td
                                key={`${date}-${sector}`}
                                className={`py-2 px-2 text-center text-xs font-mono border border-border/30 ${getBreadthTextColor(value)}`}
                                style={{ backgroundColor: getBreadthColor(value) }}
                              >
                                {value === null ? "-" : value.toFixed(0)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!breadthLoading && (!breadthData || breadthData.dates.length === 0) && (
                <div className="text-sm text-muted-foreground">{t('breadth.noData')}</div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">{t('breadth.industryTitle')}</CardTitle>
              <CardDescription>{t('breadth.industrySubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              {breadthLoading && (
                <div className="text-sm text-muted-foreground">{t('breadth.loading')}</div>
              )}
              {!breadthLoading && breadthData && breadthData.dates.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th
                          rowSpan={2}
                          className="text-left py-2 px-3 text-muted-foreground whitespace-nowrap border border-border/30"
                        >
                          {t('breadth.date')}
                        </th>
                        {INDUSTRY_GROUPS.map((group) => (
                          <th
                            key={group.sector}
                            colSpan={group.industries.length}
                            className="py-2 px-2 text-center text-muted-foreground whitespace-nowrap border border-border/30"
                          >
                            {group.sector}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {INDUSTRY_GROUPS.map((group) =>
                          group.industries.map((industry) => (
                            <th
                              key={`${group.sector}-${industry}`}
                              className="py-2 px-2 text-center text-muted-foreground whitespace-nowrap border border-border/30"
                            >
                              {industry}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {breadthData.dates.map((date) => (
                        <tr key={`industry-${date}`} className="border-t border-border/50">
                          <td className="py-2 px-3 text-muted-foreground whitespace-nowrap border border-border/30 bg-background">
                            {date}
                          </td>
                          {INDUSTRY_ORDER.map((industry) => {
                            const value = getBreadthValue(date, industry, "industry")
                            return (
                              <td
                                key={`${date}-${industry}`}
                                className={`py-2 px-2 text-center text-xs font-mono border border-border/30 ${getBreadthTextColor(value)}`}
                                style={{ backgroundColor: getBreadthColor(value) }}
                              >
                                {value === null ? "-" : value.toFixed(0)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {!breadthLoading && (!breadthData || breadthData.dates.length === 0) && (
                <div className="text-sm text-muted-foreground">{t('breadth.noData')}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Date Navigation */}
        <div className="flex flex-col items-center gap-6 mb-12">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDate("prev")}
              disabled={!canNavigatePrev || loading}
              className="h-10 w-10"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Select
              value={selectedDate}
              onValueChange={handleDateChange}
              disabled={loading || availableDates.length === 0}
            >
              <SelectTrigger className="min-w-[200px] h-10 gap-2 font-medium">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <SelectValue placeholder={availableDates.length === 0 ? t('date.loadingDates') : t('date.selectDate')} />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                {groupDatesByMonth(availableDates).map((group, groupIdx) => (
                  <SelectGroup key={group.label}>
                    {groupIdx > 0 && <SelectSeparator />}
                    <SelectLabel className="text-xs text-muted-foreground font-semibold tracking-wide">
                      {group.label}
                    </SelectLabel>
                    {group.dates.map((date) => (
                      <SelectItem key={date} value={date} className="font-mono text-sm">
                        <span className="flex items-center gap-2">
                          <span>{date}</span>
                          <span className="text-muted-foreground text-xs">{formatDateLabel(date).split(" ")[1]}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDate("next")}
              disabled={!canNavigateNext || loading}
              className="h-10 w-10"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

        </div>

        {/* Content Area */}
        <div>
          {loading && (
            <div className="text-center py-24">
              <div className="inline-flex items-center gap-3 text-muted-foreground">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                <span className="text-lg">{t('loading')}</span>
              </div>
            </div>
          )}

          {error && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="py-8">
                <div className="text-center text-destructive">
                  <p className="font-semibold mb-2">{t('errors.errorLoadingData')}</p>
                  <p className="text-sm">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !error && futuData && (
            <div className="space-y-16">
              {/* A Market Section */}
              {futuData.A && (
                <section className="py-12 px-6 sm:px-8 lg:px-10 bg-secondary/30 rounded-2xl">
                  {renderMarketSection("A", futuData.A, t('markets.chinaA'))}
                </section>
              )}

              {/* HK Market Section */}
              {futuData.HK && (
                <section className="py-12 px-6 sm:px-8 lg:px-10">
                  {renderMarketSection("HK", futuData.HK, t('markets.hongKongStock'))}
                </section>
              )}
            </div>
          )}

          {!loading && !error && !futuData && selectedDate && (
            <div className="text-center py-24">
              <p className="text-lg text-muted-foreground italic">{t('errors.noDataAvailable')}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
