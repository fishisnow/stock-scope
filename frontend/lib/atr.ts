export interface CandleBar {
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
}

export function calculateTrueRange(
  high: number,
  low: number,
  prevClose: number | null
): number {
  if (prevClose === null) {
    return high - low
  }
  return Math.max(
    high - low,
    Math.abs(high - prevClose),
    Math.abs(low - prevClose)
  )
}

/** Wilder 平滑法 14 日 ATR */
export function calculateWilderATR(
  bars: CandleBar[],
  period = 14
): number | null {
  const validBars = bars.filter(
    (bar) =>
      bar.high != null &&
      bar.low != null &&
      bar.close != null &&
      Number.isFinite(bar.high) &&
      Number.isFinite(bar.low) &&
      Number.isFinite(bar.close)
  )

  if (validBars.length < period + 1) {
    return null
  }

  const trs: number[] = []
  for (let i = 0; i < validBars.length; i++) {
    const bar = validBars[i]
    const prevClose = i > 0 ? validBars[i - 1].close! : null
    trs.push(calculateTrueRange(bar.high!, bar.low!, prevClose))
  }

  let atr = trs.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period
  }

  return atr
}

export function calculateStopLoss(
  currentPrice: number,
  atr: number,
  multiplier = 2
): number {
  return currentPrice - multiplier * atr
}

/** 从当前价到止损价的跌幅（%），正值表示亏损幅度 */
export function calculateStopLossDrawdownPercent(
  currentPrice: number,
  stopLoss: number
): number | null {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null
  if (!Number.isFinite(stopLoss)) return null
  return ((currentPrice - stopLoss) / currentPrice) * 100
}
