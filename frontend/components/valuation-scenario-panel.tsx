"use client"

import { useTranslations } from "next-intl"

import { interpretPEG, type PegVerdict } from "@/lib/valuation"
import { cn } from "@/lib/utils"

export interface ValuationScenario {
  pe?: number | null
  pe_static_reference?: number | null
  profit_growth_percent?: number | null
  profit_growth_period?: string | null
  profit_growth_field_label?: string | null
  profit_label?: string | null
  market_cap_yi?: number | null
  profit_yi?: number | null
  peg?: number | null
  payback_years?: number | null
  errors?: string[]
}

function formatMetric(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return value.toFixed(digits)
}

function verdictClass(verdict: PegVerdict): string {
  switch (verdict) {
    case "severe_under":
    case "under":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    case "fair":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
    case "high":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    case "over":
      return "border-destructive/30 bg-destructive/10 text-destructive"
  }
}

export function scenarioErrorMessage(
  code: string,
  t: ReturnType<typeof useTranslations>
): string {
  const key = `scenarioErrors.${code}` as const
  try {
    const message = t(key as never)
    if (!message || message.includes(`scenarioErrors.${code}`)) {
      return t("scenarioErrors.unknown")
    }
    return message
  } catch {
    return t("scenarioErrors.unknown")
  }
}

export function ValuationScenarioPanel({
  scenario,
  t,
  peNote,
}: {
  scenario: ValuationScenario
  t: ReturnType<typeof useTranslations>
  peNote?: string
}) {
  const hasErrors = (scenario.errors?.length ?? 0) > 0
  const peg = scenario.peg
  const verdict = peg != null && peg > 0 ? interpretPEG(peg) : null

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 p-3 sm:p-4 space-y-3">
      {scenario.profit_growth_period ? (
        <p className="text-xs text-muted-foreground">{scenario.profit_growth_period}</p>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-background/80 p-2.5">
          <p className="text-xs text-muted-foreground">{t("resultPe")}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatMetric(scenario.pe)}</p>
          {peNote ? (
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{peNote}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-border/60 bg-background/80 p-2.5">
          <p className="text-xs text-muted-foreground">
            {scenario.profit_growth_field_label ?? t("growthLabelFallback")}
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">
            {formatMetric(scenario.profit_growth_percent, 1)}%
          </p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <p className="text-xs text-muted-foreground">{t("resultPeg")}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">
            {formatMetric(scenario.peg)}
          </p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <p className="text-xs text-muted-foreground">{t("resultPayback")}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">
            {scenario.payback_years != null
              ? t("paybackYearsValue", { years: scenario.payback_years })
              : "—"}
          </p>
        </div>
      </div>

      {verdict && !hasErrors ? (
        <div className={cn("rounded-lg border px-3 py-2.5 text-sm", verdictClass(verdict))}>
          {t(`verdict.${verdict}`)}
        </div>
      ) : null}

      {hasErrors ? (
        <div className="space-y-1">
          {scenario.errors!.map((code) => (
            <p key={code} className="text-xs text-destructive">
              {scenarioErrorMessage(code, t)}
            </p>
          ))}
        </div>
      ) : null}

      {!hasErrors && scenario.payback_years != null && scenario.profit_growth_percent != null ? (
        <p className="text-xs text-muted-foreground">
          {t("paybackInterpretation", {
            years: scenario.payback_years,
            growth: formatMetric(scenario.profit_growth_percent, 1),
          })}
        </p>
      ) : null}
    </div>
  )
}
