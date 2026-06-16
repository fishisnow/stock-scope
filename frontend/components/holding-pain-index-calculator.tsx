"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Activity, Loader2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import type { CandleBar } from "@/lib/atr"
import {
  calculateHoldingPainIndex,
  HOLDING_PAIN_LOOKBACK_DAYS,
  type HoldingPainIndexResult,
} from "@/lib/holding-pain"
import {
  directCodeToSearchResult,
  findIndexByCode,
  getMarketIndexLabel,
  resolveDirectCodeInput,
  searchIndices,
  type IndexSearchResult,
} from "@/lib/market-indices"
import { PainIndexResultPanel } from "@/components/pain-index-result-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api"

type TargetKind = "stock" | "index"

interface StockSearchResult {
  code: string
  name: string
  market: string
  exchange?: string
  kind: "stock"
}

type TargetSearchResult = StockSearchResult | IndexSearchResult

interface CalculationResult {
  code: string
  name: string
  market: string
  targetKind: TargetKind
  metrics: HoldingPainIndexResult
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getLookbackRange(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - HOLDING_PAIN_LOOKBACK_DAYS)
  return { start: formatDate(start), end: formatDate(end) }
}

function targetKey(item: TargetSearchResult): string {
  return item.kind === "index"
    ? `index:${item.futuCode}`
    : `stock:${item.market}:${item.code}`
}

function formatTargetLabel(item: TargetSearchResult): string {
  return `${item.name} (${item.code})`
}

export function HoldingPainIndexCalculator() {
  const t = useTranslations("landingV2.holdingPainCalculator")
  const locale = useLocale()

  const [market, setMarket] = useState("A")
  const [query, setQuery] = useState("")
  const [selectedTarget, setSelectedTarget] = useState<TargetSearchResult | null>(null)
  const [searchResults, setSearchResults] = useState<TargetSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const searchTargets = useCallback(
    async (keyword: string, marketFilter: string) => {
      const trimmed = keyword.trim()
      if (trimmed.length < 2) {
        setSearchResults([])
        return
      }

      const indexHits = searchIndices(trimmed, marketFilter, locale)

      setSearching(true)
      try {
        const params = new URLSearchParams({ query: trimmed, market: marketFilter })
        const response = await fetch(
          `${API_URL}/stock-analysis/search-stocks?${params.toString()}`
        )
        const payload = await response.json()
        const stockHits: StockSearchResult[] =
          response.ok && payload?.success
            ? (payload.data || []).map((item: StockSearchResult) => ({
                ...item,
                kind: "stock" as const,
              }))
            : []

        const merged: TargetSearchResult[] = [...indexHits, ...stockHits]
        const directCode = resolveDirectCodeInput(trimmed, marketFilter)
        if (
          directCode &&
          !merged.some((item) => item.code.toUpperCase() === directCode.code.toUpperCase())
        ) {
          merged.push(
            directCodeToSearchResult(directCode, `${directCode.code} (${t("directCode")})`)
          )
        }
        setSearchResults(merged)
        setShowResults(true)
      } catch {
        setSearchResults(indexHits)
        setShowResults(indexHits.length > 0)
      } finally {
        setSearching(false)
      }
    },
    [locale, t]
  )

  useEffect(() => {
    if (selectedTarget && query === formatTargetLabel(selectedTarget)) {
      return
    }
    setSelectedTarget(null)

    const timer = window.setTimeout(() => {
      void searchTargets(query, market)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [query, market, searchTargets, selectedTarget])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowResults(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const selectTarget = (target: TargetSearchResult) => {
    setSelectedTarget(target)
    setMarket(target.market)
    setQuery(formatTargetLabel(target))
    setShowResults(false)
    setSearchResults([])
    setError(null)
  }

  const resolveTarget = async (): Promise<{
    code: string
    market: string
    exchange?: string
    name: string
    kind: TargetKind
  } | null> => {
    if (selectedTarget) {
      return {
        code: selectedTarget.code,
        market: selectedTarget.market,
        exchange: selectedTarget.kind === "index" ? selectedTarget.exchange : selectedTarget.exchange,
        name: selectedTarget.name,
        kind: selectedTarget.kind,
      }
    }

    const trimmed = query.trim()
    if (!trimmed) {
      return null
    }

    const indexMatch = findIndexByCode(trimmed, market)
    if (indexMatch) {
      const indexResult: IndexSearchResult = {
        code: indexMatch.code,
        name: getMarketIndexLabel(indexMatch, locale),
        market: indexMatch.market,
        exchange: indexMatch.exchange,
        kind: "index",
        futuCode: indexMatch.futuCode,
      }
      setSelectedTarget(indexResult)
      setQuery(formatTargetLabel(indexResult))
      return {
        code: indexResult.code,
        market: indexResult.market,
        exchange: indexResult.exchange,
        name: indexResult.name,
        kind: "index",
      }
    }

    const params = new URLSearchParams({ query: trimmed, market })
    const response = await fetch(
      `${API_URL}/stock-analysis/search-stocks?${params.toString()}`
    )
    const payload = await response.json()

    const indexHits = searchIndices(trimmed, market, locale)
    const stockHits: StockSearchResult[] =
      response.ok && payload?.success
        ? (payload.data || []).map((item: StockSearchResult) => ({
            ...item,
            kind: "stock" as const,
          }))
        : []

    const merged = [...indexHits, ...stockHits]
    if (merged.length === 0) {
      const directCode = resolveDirectCodeInput(trimmed, market)
      if (directCode) {
        const directTarget = directCodeToSearchResult(
          directCode,
          `${directCode.code} (${t("directCode")})`,
        )
        setSelectedTarget(directTarget)
        setQuery(formatTargetLabel(directTarget))
        return {
          code: directCode.code,
          market: directCode.market,
          exchange: directCode.exchange,
          name: directTarget.name,
          kind: directCode.kind,
        }
      }
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || t("errors.searchFailed"))
      }
      throw new Error(t("errors.notFound"))
    }
    if (merged.length > 1) {
      setSearchResults(merged)
      setShowResults(true)
      throw new Error(t("errors.multipleMatches"))
    }

    const target = merged[0]
    setSelectedTarget(target)
    setMarket(target.market)
    setQuery(formatTargetLabel(target))
    return {
      code: target.code,
      market: target.market,
      exchange: target.kind === "index" ? target.exchange : target.exchange,
      name: target.name,
      kind: target.kind,
    }
  }

  const fetchKline = async (target: {
    code: string
    market: string
    exchange?: string
  }): Promise<CandleBar[]> => {
    const { start, end } = getLookbackRange()
    const klineQuery = new URLSearchParams({
      code: target.code,
      market: target.market,
      start,
      end,
      ktype: "K_DAY",
      max_count: "200",
    })
    if (target.exchange) {
      klineQuery.set("exchange", target.exchange)
    }

    const klineResponse = await fetch(
      `${API_URL}/stock-analysis/kline-history?${klineQuery.toString()}`
    )
    const klinePayload = await klineResponse.json()
    if (!klineResponse.ok || !klinePayload?.success) {
      throw new Error(klinePayload?.error || t("errors.klineFailed"))
    }

    return (klinePayload.data || []) as CandleBar[]
  }

  const handleCalculate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const target = await resolveTarget()
      if (!target) {
        throw new Error(t("errors.queryRequired"))
      }

      const bars = await fetchKline(target)
      const sortedBars = [...bars].sort((a, b) => a.date.localeCompare(b.date))
      const metrics = calculateHoldingPainIndex(sortedBars)
      if (metrics == null) {
        throw new Error(t("errors.insufficientData"))
      }

      setResult({
        code: target.code,
        name: target.name,
        market: target.market,
        targetKind: target.kind,
        metrics,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("errors.generic")
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="h-full w-full border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader className="space-y-1.5 pb-3 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 text-primary">
          <Activity className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-[0.18em]">
            {t("badge")}
          </span>
        </div>
        <CardTitle className="text-lg sm:text-xl">{t("title")}</CardTitle>
        <CardDescription className="text-sm">{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-3 sm:grid-cols-[112px_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="pain-market">{t("marketLabel")}</Label>
            <Select
              value={market}
              onValueChange={(value) => {
                setMarket(value)
                setSelectedTarget(null)
                setError(null)
                setResult(null)
              }}
            >
              <SelectTrigger id="pain-market">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">{t("marketA")}</SelectItem>
                <SelectItem value="HK">{t("marketHK")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="relative space-y-2" ref={searchContainerRef}>
            <Label htmlFor="pain-query">{t("queryLabel")}</Label>
            <Input
              id="pain-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("queryPlaceholder")}
              autoComplete="off"
            />
            {showResults && (searching || searchResults.length > 0) ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
                {searching ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    {t("searching")}
                  </p>
                ) : (
                  searchResults.map((item) => (
                    <button
                      key={targetKey(item)}
                      type="button"
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectTarget(item)}
                    >
                      <span className="font-medium">
                        {item.name}
                        <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                          {item.kind === "index" ? t("tagIndex") : t("tagStock")}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.market} · {item.code}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={loading}
            onClick={() => void handleCalculate()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("calculating")}
              </>
            ) : (
              t("calculate")
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{t("formulaHint")}</p>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {result ? (
          <PainIndexResultPanel
            code={result.code}
            name={result.name}
            metrics={result.metrics}
            targetKind={result.targetKind}
            t={t}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
