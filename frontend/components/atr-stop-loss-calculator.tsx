"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Calculator, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

import { calculateStopLoss, calculateStopLossDrawdownPercent, calculateWilderATR, type CandleBar } from "@/lib/atr"
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
import { cn } from "@/lib/utils"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api"
const ATR_PERIOD = 14
const ATR_LOOKBACK_DAYS = 90
const STOP_LOSS_ATR_MULTIPLIER = 2

interface StockSearchResult {
  code: string
  name: string
  market: string
  exchange?: string
}

interface CalculationResult {
  code: string
  name: string
  market: string
  currentPrice: number
  atr: number
  stopLoss: number
  asOfDate: string
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function formatPrice(value: number, market: string): string {
  const digits = market === "HK" ? 3 : 2
  return value.toFixed(digits)
}

function getLookbackRange(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - ATR_LOOKBACK_DAYS)
  return { start: formatDate(start), end: formatDate(end) }
}

function isNumericCode(value: string): boolean {
  return /^\d+$/.test(value.trim())
}

export function AtrStopLossCalculator() {
  const t = useTranslations("landingV2.atrCalculator")
  const [market, setMarket] = useState("A")
  const [query, setQuery] = useState("")
  const [selectedStock, setSelectedStock] = useState<StockSearchResult | null>(null)
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CalculationResult | null>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const searchStocks = useCallback(
    async (keyword: string, marketFilter: string) => {
      const trimmed = keyword.trim()
      if (trimmed.length < 2) {
        setSearchResults([])
        return
      }

      setSearching(true)
      try {
        const params = new URLSearchParams({ query: trimmed, market: marketFilter })
        const response = await fetch(
          `${API_URL}/stock-analysis/search-stocks?${params.toString()}`
        )
        const payload = await response.json()
        if (response.ok && payload?.success) {
          setSearchResults(payload.data || [])
          setShowResults(true)
        } else {
          setSearchResults([])
        }
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    },
    []
  )

  useEffect(() => {
    if (selectedStock && query === `${selectedStock.name} (${selectedStock.code})`) {
      return
    }
    setSelectedStock(null)

    const timer = window.setTimeout(() => {
      void searchStocks(query, market)
    }, 300)

    return () => window.clearTimeout(timer)
  }, [query, market, searchStocks, selectedStock])

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

  const selectStock = (stock: StockSearchResult) => {
    setSelectedStock(stock)
    setMarket(stock.market)
    setQuery(`${stock.name} (${stock.code})`)
    setShowResults(false)
    setSearchResults([])
    setError(null)
  }

  const resolveTarget = async (): Promise<{ code: string; market: string } | null> => {
    if (selectedStock) {
      return { code: selectedStock.code, market: selectedStock.market }
    }

    const trimmed = query.trim()
    if (!trimmed) {
      return null
    }

    if (isNumericCode(trimmed)) {
      return { code: trimmed, market }
    }

    const params = new URLSearchParams({ query: trimmed, market })
    const response = await fetch(
      `${API_URL}/stock-analysis/search-stocks?${params.toString()}`
    )
    const payload = await response.json()
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || t("errors.searchFailed"))
    }

    const matches = (payload.data || []) as StockSearchResult[]
    if (matches.length === 0) {
      throw new Error(t("errors.notFound"))
    }
    if (matches.length > 1) {
      setSearchResults(matches)
      setShowResults(true)
      throw new Error(t("errors.multipleMatches"))
    }

    const stock = matches[0]
    setSelectedStock(stock)
    setMarket(stock.market)
    setQuery(`${stock.name} (${stock.code})`)
    return { code: stock.code, market: stock.market }
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

      const { code: stockCode, market: stockMarket } = target

      const priceQuery = new URLSearchParams({
        code: stockCode,
        market: stockMarket,
      })
      const priceResponse = await fetch(
        `${API_URL}/stock-analysis/get-stock-price?${priceQuery.toString()}`
      )
      const pricePayload = await priceResponse.json()
      if (!priceResponse.ok || !pricePayload?.success) {
        throw new Error(pricePayload?.error || t("errors.priceFailed"))
      }

      const currentPrice = pricePayload.data?.current_price
      if (currentPrice == null || !Number.isFinite(currentPrice)) {
        throw new Error(t("errors.priceUnavailable"))
      }

      const { start, end } = getLookbackRange()
      const klineQuery = new URLSearchParams({
        code: stockCode,
        market: stockMarket,
        start,
        end,
        ktype: "K_DAY",
        max_count: "120",
      })
      const klineResponse = await fetch(
        `${API_URL}/stock-analysis/kline-history?${klineQuery.toString()}`
      )
      const klinePayload = await klineResponse.json()
      if (!klineResponse.ok || !klinePayload?.success) {
        throw new Error(klinePayload?.error || t("errors.klineFailed"))
      }

      const bars = (klinePayload.data || []) as CandleBar[]
      const sortedBars = [...bars].sort((a, b) => a.date.localeCompare(b.date))
      const atr = calculateWilderATR(sortedBars, ATR_PERIOD)
      if (atr == null) {
        throw new Error(t("errors.insufficientData"))
      }

      const stopLoss = calculateStopLoss(currentPrice, atr, STOP_LOSS_ATR_MULTIPLIER)
      const lastBar = sortedBars[sortedBars.length - 1]

      setResult({
        code: pricePayload.data?.code || stockCode,
        name: pricePayload.data?.name || selectedStock?.name || stockCode,
        market: stockMarket,
        currentPrice,
        atr,
        stopLoss,
        asOfDate: lastBar?.date || end,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("errors.generic")
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const currency = result?.market === "HK" ? "HK$" : "¥"
  const lossPercent =
    result != null
      ? calculateStopLossDrawdownPercent(result.currentPrice, result.stopLoss)
      : null

  return (
    <Card className="h-full w-full border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader className="space-y-1.5 pb-3 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 text-primary">
          <Calculator className="h-4 w-4" />
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
            <Label htmlFor="atr-market">{t("marketLabel")}</Label>
            <Select
              value={market}
              onValueChange={(value) => {
                setMarket(value)
                setSelectedStock(null)
              }}
            >
              <SelectTrigger id="atr-market">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">{t("marketA")}</SelectItem>
                <SelectItem value="HK">{t("marketHK")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative space-y-2" ref={searchContainerRef}>
            <Label htmlFor="atr-query">{t("queryLabel")}</Label>
            <Input
              id="atr-query"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setShowResults(true)
              }}
              onFocus={() => {
                if (searchResults.length > 0) {
                  setShowResults(true)
                }
              }}
              placeholder={t("queryPlaceholder")}
              autoComplete="off"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void handleCalculate()
                }
              }}
            />
            {showResults && (searching || searchResults.length > 0) ? (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
                {searching ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">{t("searching")}</p>
                ) : (
                  searchResults.map((stock) => (
                    <button
                      key={`${stock.market}-${stock.code}`}
                      type="button"
                      className={cn(
                        "flex w-full flex-col items-start px-3 py-2 text-left text-sm",
                        "hover:bg-accent hover:text-accent-foreground"
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectStock(stock)}
                    >
                      <span className="font-medium">{stock.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {stock.market} · {stock.code}
                        {stock.exchange ? ` · ${stock.exchange}` : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => void handleCalculate()}
            disabled={loading}
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

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div>
                <p className="text-xs text-muted-foreground">{t("resultStock")}</p>
                <p className="text-base font-semibold">
                  {result.name}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({result.market} · {result.code})
                  </span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("asOfDate", { date: result.asOfDate })}
              </p>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-background/80 p-2.5">
                <p className="text-xs text-muted-foreground">{t("currentPrice")}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">
                  {currency}
                  {formatPrice(result.currentPrice, result.market)}
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/80 p-2.5">
                <p className="text-xs text-muted-foreground">
                  {t("atr14", { period: ATR_PERIOD })}
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">
                  {currency}
                  {formatPrice(result.atr, result.market)}
                </p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                <p className="text-xs text-muted-foreground">{t("stopLoss")}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">
                  {currency}
                  {formatPrice(result.stopLoss, result.market)}
                  {lossPercent != null ? (
                    <span className="ml-1 text-sm font-medium text-muted-foreground">
                      ({t("lossPercent", { percent: lossPercent.toFixed(2) })})
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
