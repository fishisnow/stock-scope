"use client"

import { PainIndexResultPanel } from "@/components/pain-index-result-panel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ValuationScenarioPanel,
  type ValuationScenario,
} from "@/components/valuation-scenario-panel"
import { Link } from "@/i18n/routing"
import type { HoldingPainIndexResult } from "@/lib/holding-pain"
import { cn } from "@/lib/utils"
import { Loader2, TrendingDown, TrendingUp } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api"

type LoadStatus = "queued" | "loading" | "ready" | "error"

interface LeaderListStock {
  code: string
  name: string
  market: "A" | "HK"
  change_ratio?: number | null
  amount?: number | null
}

interface ApiPainMetrics {
  pain_index: number
  effective_trading_days: number
  down_days: number
  up_days: number
  flat_days: number
  down_day_ratio: number
  avg_down_magnitude: number
  avg_up_magnitude: number
  magnitude_ratio: number
  longest_consecutive_down_days: number
  streak_factor: number
  period_start: string
  period_end: string
}

interface ApiValuationMetrics {
  market: string
  scenarios?: {
    dynamic?: ValuationScenario
    ttm?: ValuationScenario
  }
  profit_growth_error?: string | null
  opend_server_ver?: string | null
}

interface LeaderEntry extends LeaderListStock {
  status: LoadStatus
  pain: HoldingPainIndexResult | null
  painError: string | null
  valuation: ApiValuationMetrics | null
  valuationError: string | null
}

function entryKey(stock: LeaderListStock): string {
  return `${stock.market}:${stock.code}`
}

function mapPainMetrics(pain: ApiPainMetrics): HoldingPainIndexResult {
  return {
    painIndex: pain.pain_index,
    effectiveTradingDays: pain.effective_trading_days,
    downDays: pain.down_days,
    upDays: pain.up_days,
    flatDays: pain.flat_days,
    downDayRatio: pain.down_day_ratio,
    avgDownMagnitude: pain.avg_down_magnitude,
    avgUpMagnitude: pain.avg_up_magnitude,
    magnitudeRatio: pain.magnitude_ratio,
    longestConsecutiveDownDays: pain.longest_consecutive_down_days,
    streakFactor: pain.streak_factor,
    periodStart: pain.period_start,
    periodEnd: pain.period_end,
  }
}

function formatAmountYi(amount: number | null | undefined): string {
  return (Number(amount || 0) / 100000000).toFixed(1)
}

function MetricsLoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-muted/10 px-4">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

function LeaderStockCard({
  entry,
  painT,
  pegT,
  leaderT,
}: {
  entry: LeaderEntry
  painT: ReturnType<typeof useTranslations>
  pegT: ReturnType<typeof useTranslations>
  leaderT: ReturnType<typeof useTranslations>
}) {
  const changeRatio = Number(entry.change_ratio || 0)
  const isPositive = changeRatio > 0
  const isNegative = changeRatio < 0
  const isLoading = entry.status === "queued" || entry.status === "loading"
  const stockHref = `/stock?${new URLSearchParams({
    market: entry.market,
    code: entry.code,
    ...(entry.name ? { name: entry.name } : {}),
  }).toString()}`
  const dynamicScenario = entry.valuation?.scenarios?.dynamic

  return (
    <Card className="h-full overflow-hidden border-border/70 bg-card shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/10 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg sm:text-xl">
              <Link href={stockHref} className="hover:text-primary">
                {entry.name || entry.code}
              </Link>
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground font-mono">
              {leaderT(entry.market === "A" ? "marketA" : "marketHK")} · {entry.code}
            </p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-1.5">
              {isPositive && <TrendingUp className="h-4 w-4 text-red-600" />}
              {isNegative && <TrendingDown className="h-4 w-4 text-green-600" />}
              <span
                className={cn(
                  "text-lg font-mono font-bold",
                  isPositive ? "text-red-600" : isNegative ? "text-green-600" : "text-muted-foreground"
                )}
              >
                {isPositive ? "+" : ""}
                {changeRatio.toFixed(1)}%
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground font-mono sm:text-sm">
              {leaderT("amount")} {formatAmountYi(entry.amount)}
              {leaderT("amountUnit")}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        {isLoading ? (
          <MetricsLoadingPanel label={leaderT("stockLoading")} />
        ) : entry.status === "error" ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-8 text-center text-sm text-destructive">
            {entry.painError || entry.valuationError || leaderT("stockFailed")}
          </div>
        ) : (
          <>
            {entry.pain ? (
              <PainIndexResultPanel
                code={entry.code}
                name={entry.name || entry.code}
                metrics={entry.pain}
                t={painT}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                {entry.painError || leaderT("painUnavailable")}
              </div>
            )}

            {dynamicScenario ? (
              <ValuationScenarioPanel
                scenario={dynamicScenario}
                t={pegT}
                peNote={entry.market === "HK" ? pegT("dynamicPeNoteHk") : undefined}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-6 text-center text-sm text-muted-foreground">
                {entry.valuationError || leaderT("valuationUnavailable")}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function LeaderMetricsBoard() {
  const leaderT = useTranslations("landingV2.leaderMetrics")
  const painT = useTranslations("landingV2.holdingPainCalculator")
  const pegT = useTranslations("landingV2.pegPaybackCalculator")

  const [date, setDate] = useState<string | null>(null)
  const [entries, setEntries] = useState<LeaderEntry[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [listPending, setListPending] = useState(false)

  useEffect(() => {
    let cancelled = false

    const updateEntry = (key: string, patch: Partial<LeaderEntry>) => {
      setEntries((prev) =>
        prev.map((item) => (entryKey(item) === key ? { ...item, ...patch } : item))
      )
    }

    const loadMetricsSequentially = async (stocks: LeaderListStock[]) => {
      for (const stock of stocks) {
        if (cancelled) return
        const key = entryKey(stock)
        updateEntry(key, { status: "loading" })

        try {
          const params = new URLSearchParams({
            code: stock.code,
            market: stock.market,
            ...(stock.name ? { name: stock.name } : {}),
          })
          const response = await fetch(`${API_URL}/market-leaders/metrics?${params.toString()}`)
          const payload = await response.json()
          if (!response.ok || !payload?.success) {
            throw new Error(payload?.error || leaderT("stockFailed"))
          }

          const data = payload.data as {
            pain: ApiPainMetrics | null
            pain_error?: string | null
            valuation: ApiValuationMetrics | null
            valuation_error?: string | null
          }

          updateEntry(key, {
            status: "ready",
            pain: data.pain ? mapPainMetrics(data.pain) : null,
            painError: data.pain_error || null,
            valuation: data.valuation,
            valuationError: data.valuation_error || null,
          })
        } catch (err: unknown) {
          updateEntry(key, {
            status: "error",
            painError: err instanceof Error ? err.message : leaderT("stockFailed"),
          })
        }
      }
    }

    const bootstrap = async () => {
      setListLoading(true)
      setListError(null)
      try {
        const response = await fetch(`${API_URL}/market-leaders/list?limit=8`)
        const payload = await response.json()
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || leaderT("loadFailed"))
        }

        const data = payload.data as {
          date: string | null
          pending: boolean
          stocks: LeaderListStock[]
        }
        if (cancelled) return

        setDate(data.date)
        setListPending(Boolean(data.pending))

        const initialEntries: LeaderEntry[] = (data.stocks || []).map((stock) => ({
          ...stock,
          status: "queued",
          pain: null,
          painError: null,
          valuation: null,
          valuationError: null,
        }))
        setEntries(initialEntries)
        setListLoading(false)

        if (!data.pending && initialEntries.length > 0) {
          await loadMetricsSequentially(data.stocks)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setListError(err instanceof Error ? err.message : leaderT("loadFailed"))
          setListLoading(false)
        }
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [leaderT])

  return (
    <section
      id="leader-metrics"
      className="border-b border-border/50 bg-muted/10 px-4 py-10 sm:px-6 lg:px-10 lg:py-12"
    >
      <div className="mb-8">
        <h2 className="text-2xl font-semibold sm:text-3xl">{leaderT("title")}</h2>
        {date ? (
          <p className="mt-2 text-sm text-muted-foreground font-mono sm:text-base">
            {leaderT("asOfDate", { date })}
          </p>
        ) : null}
      </div>

      {listLoading ? (
        <div className="flex min-h-[280px] items-center justify-center gap-2 text-base text-muted-foreground sm:text-lg">
          <Loader2 className="h-5 w-5 animate-spin" />
          {leaderT("loading")}
        </div>
      ) : listError ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-16 text-center text-base text-muted-foreground sm:text-lg">
          {listError}
        </div>
      ) : listPending ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-16 text-center text-base text-muted-foreground sm:text-lg">
          {leaderT("pending")}
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
          {entries.map((entry) => (
            <LeaderStockCard
              key={entryKey(entry)}
              entry={entry}
              painT={painT}
              pegT={pegT}
              leaderT={leaderT}
            />
          ))}
        </div>
      )}
    </section>
  )
}
