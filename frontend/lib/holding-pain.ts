import type { CandleBar } from "@/lib/atr"

export const HOLDING_PAIN_LOOKBACK_DAYS = 183
export const HOLDING_PAIN_MIN_COMPARISONS = 20

export interface HoldingPainIndexResult {
  painIndex: number
  effectiveTradingDays: number
  downDays: number
  upDays: number
  flatDays: number
  downDayRatio: number
  avgDownMagnitude: number
  avgUpMagnitude: number
  magnitudeRatio: number
  longestConsecutiveDownDays: number
  streakFactor: number
  periodStart: string
  periodEnd: string
}

function isValidClose(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0
}

/**
 * 持仓痛苦指数（过去半年日 K）：
 * (下跌天数/有效交易天数) × (平均下跌幅度/平均上涨幅度) × (最长连续下跌天数/5)
 *
 * 日涨跌按收盘价相对前一日收盘价；幅度为小数收益率（0.01 = 1%）。
 */
export function calculateHoldingPainIndex(bars: CandleBar[]): HoldingPainIndexResult | null {
  const sorted = [...bars]
    .filter((bar) => isValidClose(bar.close))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (sorted.length < 2) {
    return null
  }

  let downDays = 0
  let upDays = 0
  let flatDays = 0
  const downMagnitudes: number[] = []
  const upMagnitudes: number[] = []
  let longestConsecutiveDownDays = 0
  let currentStreak = 0

  for (let i = 1; i < sorted.length; i += 1) {
    const prevClose = sorted[i - 1].close!
    const close = sorted[i].close!
    const change = (close - prevClose) / prevClose

    if (change < 0) {
      downDays += 1
      downMagnitudes.push(Math.abs(change))
      currentStreak += 1
      longestConsecutiveDownDays = Math.max(longestConsecutiveDownDays, currentStreak)
    } else if (change > 0) {
      upDays += 1
      upMagnitudes.push(change)
      currentStreak = 0
    } else {
      flatDays += 1
      currentStreak = 0
    }
  }

  const effectiveTradingDays = sorted.length - 1
  if (effectiveTradingDays < HOLDING_PAIN_MIN_COMPARISONS) {
    return null
  }

  const downDayRatio = downDays / effectiveTradingDays
  const avgDownMagnitude =
    downMagnitudes.length > 0
      ? downMagnitudes.reduce((sum, value) => sum + value, 0) / downMagnitudes.length
      : 0
  const avgUpMagnitude =
    upMagnitudes.length > 0
      ? upMagnitudes.reduce((sum, value) => sum + value, 0) / upMagnitudes.length
      : 0

  let magnitudeRatio = 0
  if (avgUpMagnitude > 0) {
    magnitudeRatio = avgDownMagnitude / avgUpMagnitude
  } else if (avgDownMagnitude > 0) {
    magnitudeRatio = avgDownMagnitude / 0.0001
  }

  const streakFactor = longestConsecutiveDownDays / 5
  const painIndex = downDayRatio * magnitudeRatio * streakFactor

  return {
    painIndex,
    effectiveTradingDays,
    downDays,
    upDays,
    flatDays,
    downDayRatio,
    avgDownMagnitude,
    avgUpMagnitude,
    magnitudeRatio,
    longestConsecutiveDownDays,
    streakFactor,
    periodStart: sorted[0].date,
    periodEnd: sorted[sorted.length - 1].date,
  }
}

export function formatPercentFromDecimal(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`
}
