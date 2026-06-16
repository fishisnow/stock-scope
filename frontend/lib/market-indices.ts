export interface MarketIndex {
  futuCode: string
  code: string
  exchange: "SH" | "SZ" | "HK"
  market: "A" | "HK"
  labelZh: string
  labelEn: string
  keywords?: string[]
}

export interface IndexSearchResult {
  code: string
  name: string
  market: "A" | "HK"
  exchange: "SH" | "SZ" | "HK"
  kind: "index"
  futuCode: string
}

export const MARKET_INDICES: MarketIndex[] = [
  { futuCode: "SH.000001", code: "000001", exchange: "SH", market: "A", labelZh: "上证指数", labelEn: "SSE Composite" },
  { futuCode: "SH.000016", code: "000016", exchange: "SH", market: "A", labelZh: "上证50", labelEn: "SSE 50" },
  { futuCode: "SH.000688", code: "000688", exchange: "SH", market: "A", labelZh: "科创50", labelEn: "STAR 50" },
  { futuCode: "SH.000906", code: "000906", exchange: "SH", market: "A", labelZh: "中证800", labelEn: "CSI 800" },
  { futuCode: "SZ.399001", code: "399001", exchange: "SZ", market: "A", labelZh: "深证成指", labelEn: "SZSE Component" },
  { futuCode: "SZ.399102", code: "399102", exchange: "SZ", market: "A", labelZh: "创业板指", labelEn: "ChiNext" },
  { futuCode: "HK.800000", code: "800000", exchange: "HK", market: "HK", labelZh: "恒生指数", labelEn: "Hang Seng Index" },
  { futuCode: "HK.800700", code: "800700", exchange: "HK", market: "HK", labelZh: "恒生科技指数", labelEn: "Hang Seng Tech" },
  {
    futuCode: "HK.800804",
    code: "800804",
    exchange: "HK",
    market: "HK",
    labelZh: "恒生医疗指数",
    labelEn: "Hang Seng Healthcare",
    keywords: ["恒生医疗", "医疗指数", "创新药"],
  },
]

export function getMarketIndexLabel(index: MarketIndex, locale: string): string {
  return locale.toLowerCase().startsWith("en") ? index.labelEn : index.labelZh
}

export function filterIndicesByMarket(market: string): MarketIndex[] {
  return MARKET_INDICES.filter((item) => item.market === market)
}

function indexMatchesQuery(index: MarketIndex, query: string, locale: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) {
    return false
  }
  const lowered = trimmed.toLowerCase()
  const label = getMarketIndexLabel(index, locale)
  if (
    index.code.toLowerCase() === lowered ||
    index.futuCode.toLowerCase() === lowered ||
    index.code.includes(trimmed) ||
    label.includes(trimmed) ||
    index.labelZh.includes(trimmed) ||
    index.labelEn.toLowerCase().includes(lowered)
  ) {
    return true
  }
  return (index.keywords ?? []).some((keyword) => keyword.includes(trimmed) || trimmed.includes(keyword))
}

export function searchIndices(
  query: string,
  market: string,
  locale: string,
): IndexSearchResult[] {
  const trimmed = query.trim()
  if (trimmed.length < 1) {
    return []
  }

  return filterIndicesByMarket(market)
    .filter((index) => indexMatchesQuery(index, trimmed, locale))
    .map((index) => ({
      code: index.code,
      name: getMarketIndexLabel(index, locale),
      market: index.market,
      exchange: index.exchange,
      kind: "index" as const,
      futuCode: index.futuCode,
    }))
}

export function findIndexByCode(code: string, market: string): MarketIndex | undefined {
  const normalized = code.trim().toUpperCase()
  return filterIndicesByMarket(market).find(
    (index) =>
      index.code.toUpperCase() === normalized ||
      index.futuCode.toUpperCase() === normalized ||
      index.futuCode.toUpperCase() === `HK.${normalized}` ||
      index.futuCode.toUpperCase() === `SH.${normalized}` ||
      index.futuCode.toUpperCase() === `SZ.${normalized}`,
  )
}

export interface DirectCodeTarget {
  code: string
  name: string
  market: "A" | "HK"
  exchange: "SH" | "SZ" | "HK"
  kind: "stock" | "index"
}

function guessKind(code: string, market: "A" | "HK"): "stock" | "index" {
  if (market === "HK") {
    return code.startsWith("800") ? "index" : "stock"
  }
  if (code.startsWith("399") || code.startsWith("000")) {
    return "index"
  }
  return "stock"
}

/** 解析用户直接输入的代码（含 SH.000906 / 800804 等），用于搜索无结果时兜底拉 K 线。 */
export function resolveDirectCodeInput(
  raw: string,
  market: string,
): DirectCodeTarget | null {
  let input = raw.trim()
  if (!input) {
    return null
  }

  const labelMatch = input.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (labelMatch) {
    input = labelMatch[2].trim()
  }

  const futuMatch = input.match(/^(SH|SZ|HK)\.(.+)$/i)
  if (futuMatch) {
    const exchange = futuMatch[1].toUpperCase() as "SH" | "SZ" | "HK"
    const code = futuMatch[2].trim()
    if (!code) {
      return null
    }
    const resolvedMarket = exchange === "HK" ? "HK" : "A"
    return {
      code,
      exchange,
      market: resolvedMarket,
      name: code,
      kind: guessKind(code, resolvedMarket),
    }
  }

  if (!/^[\dA-Za-z]+$/.test(input)) {
    return null
  }

  if (market === "HK") {
    if (input.length < 4) {
      return null
    }
    return {
      code: input,
      exchange: "HK",
      market: "HK",
      name: input,
      kind: guessKind(input, "HK"),
    }
  }

  if (market !== "A" || !/^\d+$/.test(input)) {
    return null
  }

  const code = input.length <= 6 ? input.padStart(6, "0") : input
  if (code.length !== 6) {
    return null
  }

  let exchange: "SH" | "SZ"
  if (code.startsWith("399")) {
    exchange = "SZ"
  } else if (code.startsWith("000")) {
    exchange = "SH"
  } else if (code.startsWith("6") || code.startsWith("5") || code.startsWith("9")) {
    exchange = "SH"
  } else {
    exchange = "SZ"
  }

  return {
    code,
    exchange,
    market: "A",
    name: code,
    kind: guessKind(code, "A"),
  }
}

export function directCodeToSearchResult(
  target: DirectCodeTarget,
  label: string,
): IndexSearchResult | StockSearchResult {
  if (target.kind === "index") {
    return {
      code: target.code,
      name: label,
      market: target.market,
      exchange: target.exchange,
      kind: "index",
      futuCode: `${target.exchange}.${target.code}`,
    }
  }
  return {
    code: target.code,
    name: label,
    market: target.market,
    exchange: target.exchange,
    kind: "stock",
  }
}

interface StockSearchResult {
  code: string
  name: string
  market: string
  exchange?: string
  kind: "stock"
}
