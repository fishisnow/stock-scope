import { StockKLinePage } from "@/components/stock-kline-page"

export default async function StockKLineDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ market: string; code: string }>
  searchParams?: Promise<{ name?: string }>
}) {
  const { market, code } = await params
  const { name } = (await searchParams) || {}
  return <StockKLinePage market={market} code={code} name={name} />
}

