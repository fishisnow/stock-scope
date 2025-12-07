"use client"

import { useEffect, useState } from "react"
import { Header } from "@/components/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { 
  TrendingUp, 
  TrendingDown, 
  Upload, 
  FileSpreadsheet, 
  Trophy,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  BarChart3,
  Wallet,
  Target,
  Clock
} from "lucide-react"
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

interface StockSummary {
  stock_code: string
  stock_name: string
  total_bought: number
  total_sold: number
  total_buy_amount: number
  total_sell_amount: number
  total_fees: number
  trade_count: number
  first_trade: string | null
  last_trade: string | null
  avg_buy_price: number
  avg_sell_price: number
  current_holding: number
  realized_profit: number
  profit_rate: number
}

interface TotalStats {
  total_invested: number
  total_returned: number
  total_profit: number
  total_fees: number
  winning_stocks: number
  losing_stocks: number
  total_stocks: number
}

interface TradeRecord {
  id: number
  direction: string
  stock_code: string
  stock_name: string
  order_price: number
  order_quantity: number
  order_amount: number
  trade_status: string
  filled_quantity: number
  filled_price: number
  filled_amount: number
  order_time: string
  filled_time: string
  total_fee: number
  remarks: string
}

export default function ReviewPage() {
  const t = useTranslations('review')
  const { user, session } = useAuth()
  
  const [mounted, setMounted] = useState(false)
  const [stockSummary, setStockSummary] = useState<StockSummary[]>([])
  const [totalStats, setTotalStats] = useState<TotalStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 上传状态
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<{success: boolean, message: string} | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // 交易明细弹窗
  const [selectedStock, setSelectedStock] = useState<StockSummary | null>(null)
  const [stockTrades, setStockTrades] = useState<TradeRecord[]>([])
  const [loadingTrades, setLoadingTrades] = useState(false)
  
  // 修复 hydration 错误
  useEffect(() => {
    setMounted(true)
  }, [])
  
  useEffect(() => {
    if (mounted && user && session) {
      loadSummary()
    }
  }, [mounted, user, session])
  
  const getAuthHeaders = () => {
    return {
      'Authorization': `Bearer ${session?.access_token}`,
    }
  }
  
  const loadSummary = async () => {
    if (!session?.access_token) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_URL}/api/trading/summary`, {
        headers: getAuthHeaders()
      })
      const result = await response.json()
      
      if (result.success) {
        setStockSummary(result.data)
        setTotalStats(result.total_stats)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }
  
  const handleFileUpload = async (file: File) => {
    if (!session?.access_token) {
      setUploadResult({ success: false, message: t('pleaseLogin') })
      return
    }
    
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(fileExt || '')) {
      setUploadResult({ success: false, message: t('invalidFileType') })
      return
    }
    
    setUploading(true)
    setUploadProgress(0)
    setUploadResult(null)
    
    const formData = new FormData()
    formData.append('file', file)
    
    // 模拟上传进度
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90))
    }, 200)
    
    try {
      const response = await fetch(`${API_URL}/api/trading/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      })
      
      const result = await response.json()
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      if (result.success) {
        setUploadResult({ success: true, message: result.message })
        // 重新加载数据
        await loadSummary()
      } else {
        setUploadResult({ success: false, message: result.error })
      }
    } catch (err) {
      clearInterval(progressInterval)
      setUploadResult({ success: false, message: (err as Error).message })
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files[0])
    }
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  
  const handleDragLeave = () => {
    setIsDragging(false)
  }
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileUpload(files[0])
    }
  }
  
  const loadStockTrades = async (stock: StockSummary) => {
    if (!session?.access_token) return
    
    setSelectedStock(stock)
    setLoadingTrades(true)
    
    try {
      const response = await fetch(`${API_URL}/api/trading/stock/${stock.stock_code}`, {
        headers: getAuthHeaders()
      })
      const result = await response.json()
      
      if (result.success) {
        setStockTrades(result.data)
      }
    } catch (err) {
      console.error('加载交易明细失败:', err)
    } finally {
      setLoadingTrades(false)
    }
  }
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  // 未挂载时显示加载状态，避免 hydration 错误
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-7xl">
          <div className="text-center py-24">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        </main>
      </div>
    )
  }
  
  // 未登录状态
  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-7xl">
          <div className="text-center py-24">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">{t('loginRequired')}</h2>
            <p className="text-muted-foreground">{t('loginRequiredDesc')}</p>
          </div>
        </main>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 max-w-7xl">
        {/* 页面标题 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary mb-6">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t('investmentAnalysis')}</span>
          </div>
          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-primary mb-6">{t('pageTitle')}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('pageSubtitle')}
          </p>
        </div>
        
        {/* 数据导入区域 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t('importData')}
            </CardTitle>
            <CardDescription>{t('importDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                isDragging 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">{t('dragAndDrop')}</p>
              <p className="text-sm text-muted-foreground mb-4">{t('supportedFormats')}</p>
              
              <label htmlFor="file-upload">
                <Button asChild disabled={uploading}>
                  <span className="cursor-pointer">
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('uploading')}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {t('selectFile')}
                      </>
                    )}
                  </span>
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading}
              />
              
              {uploading && (
                <div className="mt-4 max-w-xs mx-auto">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{uploadProgress}%</p>
                </div>
              )}
              
              {uploadResult && (
                <div className={`mt-4 flex items-center justify-center gap-2 ${
                  uploadResult.success ? 'text-green-600' : 'text-destructive'
                }`}>
                  {uploadResult.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span className="text-sm">{uploadResult.message}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* 统计概览 */}
        {totalStats && totalStats.total_stocks > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('totalInvested')}</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(totalStats.total_invested)}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('totalProfit')}</span>
                </div>
                <p className={`text-2xl font-bold ${
                  totalStats.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {totalStats.total_profit >= 0 ? '+' : ''}{formatCurrency(totalStats.total_profit)}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('winRate')}</span>
                </div>
                <p className="text-2xl font-bold">
                  {totalStats.total_stocks > 0 
                    ? ((totalStats.winning_stocks / totalStats.total_stocks) * 100).toFixed(1)
                    : 0}%
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{t('totalStocks')}</span>
                </div>
                <p className="text-2xl font-bold">{totalStats.total_stocks}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600">{totalStats.winning_stocks} {t('profit')}</span>
                  {' / '}
                  <span className="text-red-600">{totalStats.losing_stocks} {t('loss')}</span>
                </p>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* 盈亏排行榜 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {t('profitRanking')}
            </CardTitle>
            <CardDescription>{t('profitRankingDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                <p className="text-muted-foreground mt-2">{t('loading')}</p>
              </div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p>{error}</p>
              </div>
            ) : stockSummary.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">{t('noData')}</p>
                <p className="text-sm text-muted-foreground">{t('noDataDesc')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>{t('table.stock')}</TableHead>
                      <TableHead className="text-right">{t('table.buyAmount')}</TableHead>
                      <TableHead className="text-right">{t('table.sellAmount')}</TableHead>
                      <TableHead className="text-right">{t('table.profit')}</TableHead>
                      <TableHead className="text-right">{t('table.profitRate')}</TableHead>
                      <TableHead className="text-right">{t('table.holding')}</TableHead>
                      <TableHead className="text-right">{t('table.trades')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockSummary.map((stock, index) => (
                      <TableRow 
                        key={stock.stock_code}
                        className="cursor-pointer hover:bg-secondary/50"
                        onClick={() => loadStockTrades(stock)}
                      >
                        <TableCell className="font-medium">
                          {index < 3 ? (
                            <Badge variant={index === 0 ? "default" : "secondary"} className="w-6 h-6 p-0 flex items-center justify-center">
                              {index + 1}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{index + 1}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold">{stock.stock_name}</p>
                            <p className="text-xs text-muted-foreground">{stock.stock_code}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(stock.total_buy_amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(stock.total_sell_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {stock.realized_profit > 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : stock.realized_profit < 0 ? (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            ) : null}
                            <span className={`font-mono font-semibold ${
                              stock.realized_profit > 0 
                                ? 'text-green-600' 
                                : stock.realized_profit < 0 
                                  ? 'text-red-600' 
                                  : ''
                            }`}>
                              {stock.realized_profit >= 0 ? '+' : ''}{formatCurrency(stock.realized_profit)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono font-semibold ${
                            stock.profit_rate > 0 
                              ? 'text-green-600' 
                              : stock.profit_rate < 0 
                                ? 'text-red-600' 
                                : ''
                          }`}>
                            {stock.profit_rate >= 0 ? '+' : ''}{stock.profit_rate.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {stock.current_holding > 0 ? (
                            <Badge variant="outline">{stock.current_holding}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {stock.trade_count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* 交易明细弹窗 */}
        <Dialog open={!!selectedStock} onOpenChange={(open) => !open && setSelectedStock(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {selectedStock?.stock_name} ({selectedStock?.stock_code}) - {t('tradeHistory')}
              </DialogTitle>
              <DialogDescription>
                {t('tradeHistoryDesc')}
              </DialogDescription>
            </DialogHeader>
            
            {selectedStock && (
              <div className="space-y-4">
                {/* 汇总信息 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-secondary/30 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">{t('avgBuyPrice')}</p>
                    <p className="font-mono font-semibold">${selectedStock.avg_buy_price.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('avgSellPrice')}</p>
                    <p className="font-mono font-semibold">${selectedStock.avg_sell_price.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('totalFees')}</p>
                    <p className="font-mono font-semibold">${selectedStock.total_fees.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('realizedProfit')}</p>
                    <p className={`font-mono font-semibold ${
                      selectedStock.realized_profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedStock.realized_profit >= 0 ? '+' : ''}${selectedStock.realized_profit.toFixed(2)}
                    </p>
                  </div>
                </div>
                
                {/* 交易记录列表 */}
                <ScrollArea className="h-[400px]">
                  {loadingTrades ? (
                    <div className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('table.direction')}</TableHead>
                          <TableHead className="text-right">{t('table.quantity')}</TableHead>
                          <TableHead className="text-right">{t('table.price')}</TableHead>
                          <TableHead className="text-right">{t('table.amount')}</TableHead>
                          <TableHead className="text-right">{t('table.fee')}</TableHead>
                          <TableHead>{t('table.time')}</TableHead>
                          <TableHead>{t('table.status')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stockTrades.map((trade) => (
                          <TableRow key={trade.id}>
                            <TableCell>
                              <Badge variant={trade.direction === '买入' ? 'default' : 'destructive'}>
                                {trade.direction}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {trade.filled_quantity}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${trade.filled_price?.toFixed(4) || '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ${trade.filled_amount?.toFixed(2) || '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              ${trade.total_fee?.toFixed(2) || '0.00'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(trade.filled_time)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {trade.trade_status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </ScrollArea>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

