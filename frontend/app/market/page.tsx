"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Sparkles } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

interface Stock {
  name: string
  changeRatio: string | number
  volume: string | number
  volumeRatio: string | number
  turnoverRate: string | number
  pe: string | number
  amount?: string | number
}

interface MarketData {
  time?: string
  intersection?: Stock[]
  top_change?: Stock[]
  top_volume_ratio?: Stock[]
  top_amount?: Stock[]
}

interface FutuData {
  A?: MarketData
  HK?: MarketData
}

// StockTable Component
function StockTable({ title, data, dataType }: { title: string; data: Stock[]; dataType: string }) {
  const [showAll, setShowAll] = useState(false)
  const displayData = showAll ? data : data.slice(0, 8)
  const hasMore = data.length > 8

  return (
    <Card className="hover:shadow-lg transition-all duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl font-serif text-primary mb-2">{title}</CardTitle>
            <CardDescription>Performance metrics and trading activity</CardDescription>
          </div>
          <Badge variant="secondary" className="text-sm font-mono">
            {data.length} stocks
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="py-3 px-2 text-left text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  #
                </th>
                <th className="py-3 px-2 text-left text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground min-w-[80px]">
                  Stock
                </th>
                {(dataType === "top_amount" || dataType === "intersection") && (
                  <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                    Amt(¥B)
                  </th>
                )}
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  Change
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                  Vol(10K)
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden xl:table-cell">
                  Vol Ratio
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden md:table-cell">
                  Turnover
                </th>
                <th className="py-3 px-2 text-right text-[10px] sm:text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap hidden lg:table-cell">
                  P/E
                </th>
              </tr>
            </thead>
            <tbody>
              {displayData.map((stock, index) => {
                const changeRatio = parseFloat(String(stock.changeRatio || 0))
                const isPositive = changeRatio > 0
                const isNegative = changeRatio < 0
                const isTopThree = index < 3

                return (
                  <tr
                    key={index}
                    className={`border-b border-border/40 hover:bg-secondary/30 transition-colors ${
                      isTopThree ? "bg-secondary/10" : ""
                    }`}
                  >
                    <td className="py-3 px-2">
                      <span className={`text-xs sm:text-sm font-bold ${isTopThree ? "text-primary" : "text-muted-foreground"}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-xs sm:text-sm font-semibold truncate block max-w-[120px]">{stock.name || "-"}</span>
                    </td>
                    {(dataType === "top_amount" || dataType === "intersection") && (
                      <td className="py-3 px-2 text-right hidden sm:table-cell">
                        <span className="text-xs sm:text-sm font-mono font-medium">
                          {(parseFloat(String(stock.amount || 0)) / 100000000).toFixed(1)}
                        </span>
                      </td>
                    )}
                    <td className="py-3 px-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isPositive && <TrendingUp className="h-3 w-3 text-red-600 hidden sm:inline" />}
                        {isNegative && <TrendingDown className="h-3 w-3 text-green-600 hidden sm:inline" />}
                        <span
                          className={`text-xs sm:text-sm font-mono font-bold whitespace-nowrap ${
                            isPositive ? "text-red-600" : isNegative ? "text-green-600" : "text-muted-foreground"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {changeRatio.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right hidden lg:table-cell">
                      <span className="text-xs sm:text-sm font-mono">{(parseFloat(String(stock.volume || 0)) / 10000).toFixed(1)}</span>
                    </td>
                    <td className="py-3 px-2 text-right hidden xl:table-cell">
                      <span className="text-xs sm:text-sm font-mono">{parseFloat(String(stock.volumeRatio || 0)).toFixed(1)}</span>
                    </td>
                    <td className="py-3 px-2 text-right hidden md:table-cell">
                      <span className="text-xs sm:text-sm font-mono">{parseFloat(String(stock.turnoverRate || 0)).toFixed(1)}%</span>
                    </td>
                    <td className="py-3 px-2 text-right hidden lg:table-cell">
                      <span className="text-xs sm:text-sm font-mono">{parseFloat(String(stock.pe || 0)).toFixed(1)}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="mt-6 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAll(!showAll)}
              className="gap-2"
            >
              {showAll ? (
                <>
                  Show Less
                  <ChevronLeft className="h-4 w-4 rotate-90" />
                </>
              ) : (
                <>
                  Show All {data.length} Stocks
                  <ChevronLeft className="h-4 w-4 -rotate-90" />
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function MarketPage() {
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [futuData, setFutuData] = useState<FutuData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAvailableDates()
  }, [])

  const loadAvailableDates = async () => {
    try {
      const response = await fetch(`${API_URL}/api/dates`)
      const result = await response.json()

      if (result.success) {
        setAvailableDates(result.data)
        if (result.data.length > 0) {
          setSelectedDate(result.data[0])
          loadData(result.data[0])
        }
      } else {
        setError("Failed to load dates: " + result.error)
      }
    } catch (err) {
      setError("Network error: " + (err as Error).message)
    }
  }

  const loadData = async (date: string) => {
    if (!date) {
      setFutuData(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/futu_data/${date}`)
      const result = await response.json()

      if (result.success) {
        setFutuData(result.data)
      } else {
        setError("Failed to load data: " + result.error)
      }
    } catch (err) {
      setError("Network error: " + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    loadData(date)
  }

  const navigateDate = (direction: "prev" | "next") => {
    const currentIndex = availableDates.indexOf(selectedDate)
    if (currentIndex === -1) return

    if (direction === "prev" && currentIndex < availableDates.length - 1) {
      const newDate = availableDates[currentIndex + 1]
      handleDateChange(newDate)
    } else if (direction === "next" && currentIndex > 0) {
      const newDate = availableDates[currentIndex - 1]
      handleDateChange(newDate)
    }
  }

  const canNavigatePrev = availableDates.indexOf(selectedDate) < availableDates.length - 1
  const canNavigateNext = availableDates.indexOf(selectedDate) > 0

  const getMarketSummary = (marketData: MarketData) => {
    const allStocks = [
      ...(marketData.intersection || []),
      ...(marketData.top_change || []),
    ]
    if (allStocks.length === 0) return null

    const avgChange =
      allStocks.reduce((sum, stock) => sum + parseFloat(String(stock.changeRatio || 0)), 0) / allStocks.length
    const maxChange = Math.max(...allStocks.map((s) => parseFloat(String(s.changeRatio || 0))))
    const gainers = allStocks.filter((s) => parseFloat(String(s.changeRatio || 0)) > 0).length

    return { avgChange, maxChange, gainers, total: allStocks.length }
  }

  const renderMarketSection = (marketKey: string, marketData: MarketData, marketTitle: string) => {
    return (
      <div className="space-y-10">
        <div className="text-center mb-10">
          <h2 className="font-serif text-4xl sm:text-5xl text-primary mb-3">{marketTitle}</h2>
          {marketData.time && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Last updated: {marketData.time}</span>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {/* Featured: High Change & Volume */}
          {marketData.intersection && marketData.intersection.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-1 w-12 bg-primary rounded-full" />
                <h3 className="font-serif text-2xl text-primary">Top Performers</h3>
                <div className="h-1 flex-1 bg-primary/20 rounded-full" />
              </div>
              <StockTable title="High Change & Volume Leaders" data={marketData.intersection} dataType="intersection" />
            </div>
          )}

          {/* Top Gainers and Highest Volume side by side */}
          {((marketData.top_change && marketData.top_change.length > 0) ||
            (marketData.top_volume_ratio && marketData.top_volume_ratio.length > 0)) && (
            <>
              <div className="flex items-center gap-3 my-10">
                <div className="h-1 w-12 bg-primary/60 rounded-full" />
                <h3 className="font-serif text-2xl text-primary">Market Leaders</h3>
                <div className="h-1 flex-1 bg-primary/20 rounded-full" />
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {marketData.top_change && marketData.top_change.length > 0 && (
                  <StockTable title="Top Gainers" data={marketData.top_change} dataType="top_change" />
                )}
                {marketData.top_volume_ratio && marketData.top_volume_ratio.length > 0 && (
                  <StockTable title="Highest Volume" data={marketData.top_volume_ratio} dataType="top_volume_ratio" />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-7xl">
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Real-time Market Intelligence</span>
          </div>
          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-primary mb-6">Market Data</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Daily stock market analysis with comprehensive performance metrics and trading insights
          </p>
        </div>

        {/* Date Navigation */}
        <div className="flex flex-col items-center gap-6 mb-12">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDate("prev")}
              disabled={!canNavigatePrev || loading}
              className="h-10 w-10"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                disabled={loading}
                className="appearance-none pl-10 pr-8 py-2.5 border border-border rounded-lg text-sm font-medium bg-background text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring disabled:opacity-50 min-w-[180px] cursor-pointer hover:bg-secondary/50"
              >
                {availableDates.length === 0 ? (
                  <option value="">Loading dates...</option>
                ) : (
                  <>
                    <option value="">Select date</option>
                    {availableDates.map((date) => (
                      <option key={date} value={date}>
                        {date}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <ChevronLeft className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rotate-[-90deg]" />
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateDate("next")}
              disabled={!canNavigateNext || loading}
              className="h-10 w-10"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {selectedDate && !loading && (
            <div className="text-sm text-muted-foreground">
              Viewing data for <span className="font-semibold text-foreground">{selectedDate}</span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div>
          {loading && (
            <div className="text-center py-24">
              <div className="inline-flex items-center gap-3 text-muted-foreground">
                <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                <span className="text-lg">Loading market data...</span>
              </div>
            </div>
          )}

          {error && (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="py-8">
                <div className="text-center text-destructive">
                  <p className="font-semibold mb-2">Error Loading Data</p>
                  <p className="text-sm">{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && !error && futuData && (
            <div className="space-y-16">
              {/* Market Summary Cards */}
              {(futuData.A || futuData.HK) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                  {futuData.A && (() => {
                    const summary = getMarketSummary(futuData.A)
                    return summary ? (
                      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                        <CardHeader>
                          <CardTitle className="text-2xl font-serif text-primary">China A-Share Market</CardTitle>
                          <CardDescription>Market performance overview</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Avg Change</p>
                              <p className={`text-2xl font-bold ${summary.avgChange >= 0 ? "text-red-600" : "text-green-600"}`}>
                                {summary.avgChange >= 0 ? "+" : ""}{summary.avgChange.toFixed(2)}%
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Top Gainer</p>
                              <p className="text-2xl font-bold text-red-600">+{summary.maxChange.toFixed(2)}%</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Gainers</p>
                              <p className="text-2xl font-bold">{summary.gainers} stocks</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Total Tracked</p>
                              <p className="text-2xl font-bold">{summary.total} stocks</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : null
                  })()}

                  {futuData.HK && (() => {
                    const summary = getMarketSummary(futuData.HK)
                    return summary ? (
                      <Card className="border-secondary/50">
                        <CardHeader>
                          <CardTitle className="text-2xl font-serif text-primary">Hong Kong Market</CardTitle>
                          <CardDescription>Market performance overview</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Avg Change</p>
                              <p className={`text-2xl font-bold ${summary.avgChange >= 0 ? "text-red-600" : "text-green-600"}`}>
                                {summary.avgChange >= 0 ? "+" : ""}{summary.avgChange.toFixed(2)}%
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Top Gainer</p>
                              <p className="text-2xl font-bold text-red-600">+{summary.maxChange.toFixed(2)}%</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Gainers</p>
                              <p className="text-2xl font-bold">{summary.gainers} stocks</p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Total Tracked</p>
                              <p className="text-2xl font-bold">{summary.total} stocks</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ) : null
                  })()}
                </div>
              )}

              {/* A Market Section */}
              {futuData.A && (
                <section className="py-12 px-6 sm:px-8 lg:px-10 bg-secondary/30 rounded-2xl">
                  {renderMarketSection("A", futuData.A, "China A-Share Market")}
                </section>
              )}

              {/* HK Market Section */}
              {futuData.HK && (
                <section className="py-12 px-6 sm:px-8 lg:px-10">
                  {renderMarketSection("HK", futuData.HK, "Hong Kong Stock Market")}
                </section>
              )}
            </div>
          )}

          {!loading && !error && !futuData && selectedDate && (
            <div className="text-center py-24">
              <p className="text-lg text-muted-foreground italic">No data available for selected date</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
