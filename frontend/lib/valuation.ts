export type PegVerdict = "severe_under" | "under" | "fair" | "high" | "over"

export function calculatePEG(pe: number, growthRatePercent: number): number | null {
  if (!Number.isFinite(pe) || pe <= 0) return null
  if (!Number.isFinite(growthRatePercent) || growthRatePercent <= 0) return null
  return pe / growthRatePercent
}

export function interpretPEG(peg: number): PegVerdict {
  if (peg < 0.5) return "severe_under"
  if (peg < 1) return "under"
  if (peg <= 1) return "fair"
  if (peg <= 2) return "high"
  return "over"
}

export function calculatePeFromEps(price: number, eps: number): number | null {
  if (!Number.isFinite(price) || price <= 0) return null
  if (!Number.isFinite(eps) || eps <= 0) return null
  return price / eps
}

export function predictForwardEps(ttmEps: number, growthRateDecimal: number): number | null {
  if (!Number.isFinite(ttmEps) || ttmEps <= 0) return null
  if (!Number.isFinite(growthRateDecimal)) return null
  return ttmEps * (1 + growthRateDecimal)
}

/**
 * 盈利回收期（年），g 为小数（如 0.2 表示 20%）
 */
export function calculatePaybackYears(
  marketCap: number,
  ttmNetProfit: number,
  growthRateDecimal: number
): number | null {
  if (!Number.isFinite(marketCap) || marketCap <= 0) return null
  if (!Number.isFinite(ttmNetProfit) || ttmNetProfit <= 0) return null
  if (!Number.isFinite(growthRateDecimal) || growthRateDecimal <= -0.99) return null

  const pe = marketCap / ttmNetProfit

  if (Math.abs(growthRateDecimal) < 1e-9) {
    return pe
  }

  const g = growthRateDecimal
  const b = 1 + (g * pe) / (1 + g)
  if (b <= 1) return null

  const n = Math.log(b) / Math.log(1 + g)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.ceil(n)
}

export function percentToDecimal(percent: number): number {
  return percent / 100
}
