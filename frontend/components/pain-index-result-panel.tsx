"use client"

import { useTranslations } from "next-intl"

import { formatPercentFromDecimal, type HoldingPainIndexResult } from "@/lib/holding-pain"
import { cn } from "@/lib/utils"

type PainLevel = "low" | "medium" | "high"

function getPainLevel(painIndex: number): PainLevel {
  if (painIndex < 0.15) return "low"
  if (painIndex < 0.35) return "medium"
  return "high"
}

function getPainIndexTheme(painIndex: number) {
  const level = getPainLevel(painIndex)
  if (level === "low") {
    return {
      level,
      panel: "border-emerald-500/35 bg-gradient-to-b from-emerald-500/12 via-emerald-500/6 to-background/80",
      value: "text-emerald-600 dark:text-emerald-400",
      caption: "text-emerald-700/90 dark:text-emerald-300/90",
      detail: "text-emerald-900/70 dark:text-emerald-200/70",
    }
  }
  if (level === "medium") {
    return {
      level,
      panel: "border-amber-500/35 bg-gradient-to-b from-amber-500/12 via-amber-500/6 to-background/80",
      value: "text-amber-600 dark:text-amber-400",
      caption: "text-amber-800/90 dark:text-amber-300/90",
      detail: "text-amber-900/70 dark:text-amber-200/70",
    }
  }
  return {
    level,
    panel: "border-red-500/35 bg-gradient-to-b from-red-500/12 via-red-500/6 to-background/80",
    value: "text-red-600 dark:text-red-400",
    caption: "text-red-700/90 dark:text-red-300/90",
    detail: "text-red-900/70 dark:text-red-200/70",
  }
}

export function PainIndexResultPanel({
  code,
  name,
  metrics,
  targetKind = "stock",
  t,
}: {
  code: string
  name: string
  metrics: HoldingPainIndexResult
  targetKind?: "stock" | "index"
  t: ReturnType<typeof useTranslations>
}) {
  const theme = getPainIndexTheme(metrics.painIndex)

  return (
    <div className={cn("rounded-xl border p-4 sm:p-5", theme.panel)}>
      <div className="mb-3 text-center">
        <p className={cn("text-xs font-medium", theme.caption)}>
          {name} ({code})
          <span className="mx-1.5 text-muted-foreground">·</span>
          {targetKind === "index" ? t("tagIndex") : t("tagStock")}
        </p>
        <p className={cn("mt-1 text-[11px]", theme.detail)}>
          {t("periodRange", {
            start: metrics.periodStart,
            end: metrics.periodEnd,
          })}
          <span className="mx-1.5 text-muted-foreground">·</span>
          {t("lookbackHint")}
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-4">
        <div className="space-y-3 text-right">
          <div>
            <p className={cn("text-[10px] uppercase tracking-wide", theme.detail)}>
              {t("downDayRatio")}
            </p>
            <p className={cn("mt-0.5 text-xs font-medium tabular-nums", theme.caption)}>
              {metrics.downDays}/{metrics.effectiveTradingDays}
            </p>
            <p className={cn("text-[11px] tabular-nums", theme.detail)}>
              {formatPercentFromDecimal(metrics.downDayRatio)}
            </p>
          </div>
          <div>
            <p className={cn("text-[10px] uppercase tracking-wide", theme.detail)}>
              {t("longestDownStreak")}
            </p>
            <p className={cn("mt-0.5 text-xs font-medium tabular-nums", theme.caption)}>
              {t("streakValue", {
                days: metrics.longestConsecutiveDownDays,
                factor: metrics.streakFactor.toFixed(2),
              })}
            </p>
          </div>
        </div>

        <div className="flex min-w-[7.5rem] flex-col items-center justify-center px-2 text-center sm:min-w-[9rem]">
          <p className={cn("text-[11px] font-medium", theme.detail)}>{t("resultPainIndex")}</p>
          <p className={cn("mt-1 text-4xl font-bold leading-none tabular-nums sm:text-5xl", theme.value)}>
            {metrics.painIndex.toFixed(4)}
          </p>
          <p className={cn("mt-2 max-w-[11rem] text-[11px] leading-snug", theme.caption)}>
            {t(`levels.${theme.level}`)}
          </p>
        </div>

        <div className="space-y-3 text-left">
          <div>
            <p className={cn("text-[10px] uppercase tracking-wide", theme.detail)}>
              {t("magnitudeRatio")}
            </p>
            <p className={cn("mt-0.5 text-xs font-medium tabular-nums", theme.caption)}>
              {formatPercentFromDecimal(metrics.avgDownMagnitude)} /{" "}
              {formatPercentFromDecimal(metrics.avgUpMagnitude)}
            </p>
            <p className={cn("text-[11px] tabular-nums", theme.detail)}>
              {metrics.magnitudeRatio.toFixed(2)}
            </p>
          </div>
          <div>
            <p className={cn("text-[10px] uppercase tracking-wide", theme.detail)}>
              {t("dayBreakdown")}
            </p>
            <p className={cn("mt-0.5 text-xs font-medium tabular-nums", theme.caption)}>
              {t("dayBreakdownValue", {
                down: metrics.downDays,
                up: metrics.upDays,
                flat: metrics.flatDays,
              })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
