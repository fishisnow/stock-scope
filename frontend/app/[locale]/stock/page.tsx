"use client"

import { useSearchParams } from "next/navigation"

import { StockKLinePage } from "@/components/stock-kline-page"

export default function StockPage() {
  const searchParams = useSearchParams()
  const market = searchParams.get("market") || "A"
  const code = searchParams.get("code") || ""
  const name = searchParams.get("name") || undefined

  return <StockKLinePage market={market} code={code} name={name} />
}
