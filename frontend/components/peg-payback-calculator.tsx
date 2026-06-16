"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { LineChart, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  scenarioErrorMessage,
  ValuationScenarioPanel,
  type ValuationScenario,
} from "@/components/valuation-scenario-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api"

interface StockSearchResult {
  code: string
  name: string
  market: string
  exchange?: string
}

interface ValuationMetrics {
  code: string
  name: string
  market: string
  pe_static?: number | null
  pe_ttm?: number | null
  market_cap_yi?: number | null
  profit_growth_error?: string | null
  opend_server_ver?: string | null
  scenarios?: {
    dynamic?: ValuationScenario
    ttm?: ValuationScenario
  }
}

export function PegPaybackCalculator() {
  const t = useTranslations("landingV2.pegPaybackCalculator")

  const [market, setMarket] = useState("A")
  const [query, setQuery] = useState("")
  const [selectedStock, setSelectedStock] = useState<StockSearchResult | null>(null)
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [fetchingMetrics, setFetchingMetrics] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<ValuationMetrics | null>(null)
  const [scenarioTab, setScenarioTab] = useState<"dynamic" | "ttm">("dynamic")
  const searchContainerRef = useRef<HTMLDivElement>(null)

  const searchStocks = useCallback(async (keyword: string, marketFilter: string) => {
    const trimmed = keyword.trim()
    if (trimmed.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const params = new URLSearchParams({ query: trimmed, market: marketFilter })
      const response = await fetch(`${API_URL}/stock-analysis/search-stocks?${params}`)
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
  }, [])

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
    setFetchError(null)
  }

  const fetchMetrics = async (stock: StockSearchResult) => {
    setFetchingMetrics(true)
    setFetchError(null)
    setMetrics(null)
    setScenarioTab("dynamic")
    try {
      const params = new URLSearchParams({ code: stock.code, market: stock.market })
      const response = await fetch(
        `${API_URL}/stock-analysis/valuation-metrics?${params.toString()}`
      )
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || t("fetch.failed"))
      }
      setMetrics(payload.data as ValuationMetrics)
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : t("fetch.failed"))
    } finally {
      setFetchingMetrics(false)
    }
  }

  const handleFetchMetrics = async () => {
    if (selectedStock) {
      await fetchMetrics(selectedStock)
      return
    }
    const trimmed = query.trim()
    if (!trimmed) {
      setFetchError(t("fetch.stockRequired"))
      return
    }
    if (/^\d+$/.test(trimmed)) {
      await fetchMetrics({ code: trimmed, name: trimmed, market })
      return
    }
    const params = new URLSearchParams({ query: trimmed, market })
    const response = await fetch(`${API_URL}/stock-analysis/search-stocks?${params}`)
    const payload = await response.json()
    const matches = (payload.data || []) as StockSearchResult[]
    if (!response.ok || !payload?.success || matches.length !== 1) {
      setFetchError(t("fetch.pickStock"))
      return
    }
    selectStock(matches[0])
    await fetchMetrics(matches[0])
  }

  return (
    <Card className="h-full w-full border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader className="space-y-1.5 pb-3 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 text-primary">
          <LineChart className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-[0.18em]">
            {t("badge")}
          </span>
        </div>
        <CardTitle className="text-lg sm:text-xl">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="rounded-xl border border-border/70 bg-muted/15 p-3 space-y-3">
          <p className="text-sm font-medium">{t("fetch.title")}</p>
          <div className="grid gap-3 sm:grid-cols-[112px_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="val-market">{t("fetch.marketLabel")}</Label>
              <Select
                value={market}
                onValueChange={(value) => {
                  setMarket(value)
                  setSelectedStock(null)
                }}
              >
                <SelectTrigger id="val-market">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">{t("fetch.marketA")}</SelectItem>
                  <SelectItem value="HK">{t("fetch.marketHK")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative space-y-2" ref={searchContainerRef}>
              <Label htmlFor="val-query">{t("fetch.queryLabel")}</Label>
              <Input
                id="val-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("fetch.queryPlaceholder")}
                autoComplete="off"
              />
              {showResults && (searching || searchResults.length > 0) ? (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
                  {searching ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">{t("fetch.searching")}</p>
                  ) : (
                    searchResults.map((stock) => (
                      <button
                        key={`${stock.market}-${stock.code}`}
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectStock(stock)}
                      >
                        <span className="font-medium">{stock.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {stock.market} · {stock.code}
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
              disabled={fetchingMetrics}
              onClick={() => void handleFetchMetrics()}
            >
              {fetchingMetrics ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("fetch.loading")}
                </>
              ) : (
                t("fetch.action")
              )}
            </Button>
          </div>
          {fetchError ? (
            <p className="text-sm text-destructive">{fetchError}</p>
          ) : null}
          {metrics?.profit_growth_error ? (
            <p className="text-sm text-destructive">
              {metrics.opend_server_ver
                ? t("fetch.hintGrowthFailedWithOpend", {
                    error: scenarioErrorMessage(metrics.profit_growth_error, t),
                    version: metrics.opend_server_ver,
                  })
                : t("fetch.hintGrowthFailed", {
                    error: scenarioErrorMessage(metrics.profit_growth_error, t),
                  })}
            </p>
          ) : null}
        </div>

        {metrics?.scenarios ? (
          <Tabs
            value={scenarioTab}
            onValueChange={(value) => setScenarioTab(value as "dynamic" | "ttm")}
            defaultValue="dynamic"
            className="w-full"
          >
            <TabsList className="grid h-9 w-full grid-cols-2">
              <TabsTrigger value="dynamic" className="text-xs sm:text-sm">
                {t("scenarios.dynamicTab")}
              </TabsTrigger>
              <TabsTrigger value="ttm" className="text-xs sm:text-sm">
                {t("scenarios.ttmTab")}
              </TabsTrigger>
            </TabsList>
            {metrics.scenarios.dynamic ? (
              <TabsContent value="dynamic" className="mt-3">
                <ValuationScenarioPanel
                  scenario={metrics.scenarios.dynamic}
                  t={t}
                  peNote={
                    metrics.market === "HK" ? t("dynamicPeNoteHk") : undefined
                  }
                />
              </TabsContent>
            ) : null}
            {metrics.scenarios.ttm ? (
              <TabsContent value="ttm" className="mt-3">
                <ValuationScenarioPanel scenario={metrics.scenarios.ttm} t={t} />
              </TabsContent>
            ) : null}
          </Tabs>
        ) : null}
      </CardContent>
    </Card>
  )
}
