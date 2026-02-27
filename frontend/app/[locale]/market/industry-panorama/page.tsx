"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/routing"
import { getLocalizedIndustryName } from "@/lib/industry-labels"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

interface MarketBreadthRecord {
  date: string
  breadth_type: string
  sector: string
  total_count: number
  breadth_pct: number
}

interface MarketBreadthData {
  dates: string[]
  records: MarketBreadthRecord[]
}

const INDUSTRY_GROUPS: Array<{ sector: string; industries: string[] }> = [
  { sector: "科技", industries: ["半导体", "消费电子", "光学光电子", "通信设备", "IT服务", "软件开发", "计算机设备", "自动化设备", "其他电子", "元件", "文化传媒", "影视院线", "游戏", "通信服务", "通用设备", "专用设备", "电机", "工程机械", "轨交设备"] },
  { sector: "医药", industries: ["化学制药", "生物制品", "中药", "医疗器械", "医疗服务", "医药商业"] },
  { sector: "消费", industries: ["白酒", "饮料制造", "食品加工制造", "白色家电", "黑色家电", "小家电", "厨卫电器", "服装家纺", "纺织制造", "家居用品", "包装印刷", "造纸", "种植业与林业", "农产品加工", "养殖业", "旅游及酒店", "零售", "互联网电商", "贸易", "教育", "美容护理", "其他社会服务", "综合"] },
  { sector: "汽车", industries: ["汽车整车", "汽车零部件", "汽车服务及其他"] },
  { sector: "新能源", industries: ["电池", "风电设备", "光伏设备", "其他电源设备"] },
  { sector: "军工", industries: ["军工电子", "军工装备"] },
  { sector: "原材料", industries: ["化学原料", "化学制品", "化学纤维", "农化制品", "塑料制品", "橡胶制品", "石油加工贸易", "油气开采及服务", "工业金属", "小金属", "贵金属", "能源金属", "非金属材料", "建筑材料", "钢铁", "煤炭开采加工", "金属新材料", "电子化学品"] },
  { sector: "公用事业和基建", industries: ["电力", "燃气", "环保设备", "环境治理", "建筑装饰", "房地产", "电网设备"] },
  { sector: "金融", industries: ["银行", "证券", "保险", "多元金融"] },
  { sector: "交运物流", industries: ["港口航运", "公路铁路运输", "机场航运", "物流"] },
]

function getBreadthColor(value: number | null) {
  if (value === null) return "transparent"
  const clamped = Math.max(0, Math.min(100, value))
  const linear = Math.abs(clamped - 50) / 50
  const ratio = Math.pow(linear, 0.65)
  const r = clamped >= 50 ? Math.round(255 - ratio * (255 - 207)) : Math.round(255 - ratio * (255 - 0))
  const g = clamped >= 50 ? Math.round(255 - ratio * (255 - 42)) : Math.round(255 - ratio * (255 - 135))
  const b = clamped >= 50 ? Math.round(255 - ratio * (255 - 42)) : Math.round(255 - ratio * (255 - 58))
  return `rgb(${r}, ${g}, ${b})`
}

function getBreadthTextColor(value: number | null) {
  if (value === null) return "text-muted-foreground"
  const linear = Math.abs(Math.max(0, Math.min(100, value)) - 50) / 50
  const ratio = Math.pow(linear, 0.65)
  return ratio > 0.35 ? "text-white" : "text-slate-900"
}

function getGlobalWeightSpan(count: number, globalMax: number) {
  if (!globalMax || globalMax <= 0) return 2
  const ratio = count / globalMax
  if (ratio >= 0.9) return 6
  if (ratio >= 0.75) return 5
  if (ratio >= 0.55) return 4
  return 2
}

function getGlobalWeightMinHeight(count: number, globalMax: number) {
  if (!globalMax || globalMax <= 0) return 72
  const ratio = count / globalMax
  if (ratio >= 0.9) return 108
  if (ratio >= 0.75) return 92
  return 72
}

export default function IndustryPanoramaPage() {
  const t = useTranslations("market")
  const locale = useLocale()
  const [breadthData, setBreadthData] = useState<MarketBreadthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadBreadthData = async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_URL}/api/market_breadth?limit=30`)
        const result = await response.json()
        if (result.success) {
          setBreadthData(result.data)
        } else {
          setError(t("errors.failedToLoadData") + ": " + result.error)
        }
      } catch (err) {
        setError(t("errors.networkError") + ": " + (err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    loadBreadthData()
  }, [t])

  const latestBreadthDate = breadthData?.dates?.[0] || ""
  const latestIndustryMap = useMemo(() => {
    const map = new Map<string, { breadthPct: number | null; totalCount: number }>()
    if (!breadthData || !latestBreadthDate) return map
    for (const item of breadthData.records) {
      if (item.date !== latestBreadthDate || item.breadth_type !== "industry") continue
      map.set(item.sector, {
        breadthPct: Number.isFinite(Number(item.breadth_pct)) ? Number(item.breadth_pct) : null,
        totalCount: Number(item.total_count || 0),
      })
    }
    return map
  }, [breadthData, latestBreadthDate])

  const allCounts = Array.from(latestIndustryMap.values()).map((item) => item.totalCount)
  const globalMaxCount = Math.max(...allCounts, 1)
  const orderedIndustryGroups = useMemo(() => {
    return [...INDUSTRY_GROUPS].sort((a, b) => {
      const aTotal = a.industries.reduce(
        (sum, industry) => sum + (latestIndustryMap.get(industry)?.totalCount || 0),
        0
      )
      const bTotal = b.industries.reduce(
        (sum, industry) => sum + (latestIndustryMap.get(industry)?.totalCount || 0),
        0
      )
      return bTotal - aTotal
    })
  }, [latestIndustryMap])
  const packedRows = useMemo(() => {
    const columnsPerRow = 22
    type Tile = {
      key: string
      industry: string
      breadthValue: number | null
      span: number
      minHeight: number
    }

    const tiles: Tile[] = orderedIndustryGroups.flatMap((group) =>
      group.industries.map((industry) => {
        const stat = latestIndustryMap.get(industry)
        const breadthValue = stat?.breadthPct ?? null
        const count = stat?.totalCount ?? 0
        return {
          key: `panorama-${group.sector}-${industry}`,
          industry,
          breadthValue,
          span: getGlobalWeightSpan(count, globalMaxCount),
          minHeight: getGlobalWeightMinHeight(count, globalMaxCount),
        }
      })
    )

    const rows: Tile[][] = []
    let currentRow: Tile[] = []
    let currentWidth = 0

    for (const tile of tiles) {
      if (currentWidth + tile.span > columnsPerRow && currentRow.length > 0) {
        rows.push(currentRow)
        currentRow = [tile]
        currentWidth = tile.span
      } else {
        currentRow.push(tile)
        currentWidth += tile.span
      }
    }
    if (currentRow.length > 0) rows.push(currentRow)

    // 将最后一行扩展填满，消除尾部缺口
    const lastRow = rows[rows.length - 1]
    if (lastRow && lastRow.length > 0) {
      const lastWidth = lastRow.reduce((sum, tile) => sum + tile.span, 0)
      let deficit = columnsPerRow - lastWidth
      let idx = lastRow.length - 1
      while (deficit > 0 && lastRow.length > 0) {
        lastRow[idx].span += 1
        deficit -= 1
        idx -= 1
        if (idx < 0) idx = lastRow.length - 1
      }
    }

    return rows
  }, [orderedIndustryGroups, latestIndustryMap, globalMaxCount])

  const title = latestBreadthDate
    ? t("breadth.panoramaTitleWithDate", { date: latestBreadthDate })
    : t("breadth.panoramaTitleNoDate")

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Header />
      <main className="h-[calc(100vh-76px)] px-2 sm:px-3 lg:px-4 py-2 sm:py-3 overflow-hidden">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h1 className="text-sm sm:text-lg font-semibold text-primary truncate">{title}</h1>
          <Button variant="outline" size="sm" asChild>
            <Link href="/market">
              <ArrowLeft className="h-4 w-4" />
              {t("breadth.backToMarket")}
            </Link>
          </Button>
        </div>

        {loading && <div className="text-sm text-muted-foreground">{t("breadth.loading")}</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!loading && !error && (!breadthData || breadthData.dates.length === 0) && (
          <div className="text-sm text-muted-foreground">{t("breadth.noData")}</div>
        )}

        {!loading && !error && breadthData && breadthData.dates.length > 0 && (
          <div className="h-[calc(100%-1rem)] rounded-md border border-border/40 p-1.5 overflow-y-auto overflow-x-hidden">
            <div className="min-h-full flex items-center justify-center">
              <div className="w-full space-y-1">
              {packedRows.map((row, rowIndex) => (
                <div
                  key={`row-${rowIndex}`}
                  className="grid gap-1"
                  style={{ gridTemplateColumns: "repeat(22, minmax(0, 1fr))" }}
                >
                  {row.map((tile) => (
                    <Link
                      key={tile.key}
                      href={`/market/industry/${encodeURIComponent(tile.industry)}`}
                      className={`relative rounded border border-border/30 p-2 ${getBreadthTextColor(tile.breadthValue)}`}
                      style={{
                        backgroundColor: getBreadthColor(tile.breadthValue),
                        gridColumn: `span ${tile.span} / span ${tile.span}`,
                        minHeight: `${tile.minHeight}px`,
                      }}
                      title={t("breadth.industryClickHint")}
                    >
                      <div className="absolute top-1 right-1 text-[9px] font-mono opacity-90">
                        {tile.breadthValue === null ? "-" : tile.breadthValue.toFixed(0)}
                      </div>
                      <div className="text-sm font-semibold leading-tight pr-6 line-clamp-2">
                        {getLocalizedIndustryName(tile.industry, locale)}
                      </div>
                    </Link>
                  ))}
                </div>
              ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
