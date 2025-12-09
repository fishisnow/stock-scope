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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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
  Clock,
  Calendar,
  RefreshCw
} from "lucide-react"
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth-context'
import { ProfitBarChart } from "@/components/profit-bar-chart"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

interface StockSummary {
  stock_code: string
  stock_name: string
  currency: string
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
  currency: string
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
  
  // 时间过滤
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  
  // 修复 hydration 错误
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // 只在初始化时加载数据，不再自动响应时间筛选的变化
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
      let url = `${API_URL}/api/trading/summary`
      const params = new URLSearchParams()
      
      if (startDate) {
        params.append('start_date', startDate)
      }
      if (endDate) {
        params.append('end_date', endDate)
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`
      }
      
      const response = await fetch(url, {
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
  
  // 快捷时间选项 - 立即应用
  const setQuickTimeRange = (type: string) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let start = new Date()
    
    switch (type) {
      case '1m':
        start = new Date(today)
        start.setMonth(start.getMonth() - 1)
        break
      case '3m':
        start = new Date(today)
        start.setMonth(start.getMonth() - 3)
        break
      case '6m':
        start = new Date(today)
        start.setMonth(start.getMonth() - 6)
        break
      case '1y':
        start = new Date(today)
        start.setFullYear(start.getFullYear() - 1)
        break
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1)
        break
      default:
        return
    }
    
    const startDateStr = start.toISOString().split('T')[0]
    const endDateStr = today.toISOString().split('T')[0]
    
    setStartDate(startDateStr)
    setEndDate(endDateStr)
    
    // 立即应用筛选
    loadSummaryWithDates(startDateStr, endDateStr)
  }
  
  // 应用筛选（用于自定义日期）
  const applyFilter = () => {
    loadSummary()
  }
  
  // 清除筛选
  const clearFilter = () => {
    setStartDate("")
    setEndDate("")
    loadSummary()
  }
  
  // 带日期参数的加载函数
  const loadSummaryWithDates = async (start?: string, end?: string) => {
    if (!session?.access_token) return
    
    setLoading(true)
    setError(null)
    
    try {
      let url = `${API_URL}/api/trading/summary`
      const params = new URLSearchParams()
      
      const startParam = start !== undefined ? start : startDate
      const endParam = end !== undefined ? end : endDate
      
      if (startParam) {
        params.append('start_date', startParam)
      }
      if (endParam) {
        params.append('end_date', endParam)
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`
      }
      
      const response = await fetch(url, {
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
  
  const formatCurrency = (value: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  }
  
  const formatPrice = (value: number, currency: string = 'USD') => {
    const symbol = currency === 'HKD' ? 'HK$' : 'US$'
    return `${symbol}${value.toFixed(4)}`
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
        
        {/* 操作工具栏 - 紧凑设计 */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-start">
              {/* 左侧：数据导入 */}
              <div className="flex-shrink-0 lg:w-80">
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">{t('importData')}</Label>
                </div>
                <div className="flex gap-2">
                  <label htmlFor="file-upload" className="flex-1">
                    <Button size="sm" variant="outline" className="w-full h-9" asChild disabled={uploading}>
                      <span className="cursor-pointer">
                        {uploading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                            {uploadProgress}%
                          </>
                        ) : (
                          <>
                            <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />
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
                </div>
                {uploadResult && (
                  <p className={`text-xs mt-2 flex items-center gap-1.5 ${
                    uploadResult.success ? 'text-blue-600' : 'text-destructive'
                  }`}>
                    {uploadResult.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5" />
                    )}
                    <span>{uploadResult.message}</span>
                  </p>
                )}
                {uploading && (
                  <div className="mt-2">
                    <Progress value={uploadProgress} className="h-1" />
                  </div>
                )}
              </div>
              
              {/* 分隔线 */}
              <div className="hidden lg:block w-px bg-border self-stretch min-h-[60px]"></div>
              
              {/* 右侧：时间筛选 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">{t('timeFilter')}</Label>
                  
                  {/* 当前选择的时间范围 Badge */}
                  {(startDate || endDate) && (
                    <>
                      <Badge variant="secondary" className="text-xs font-normal">
                        <Clock className="h-3 w-3 mr-1" />
                        {startDate || t('start')} ~ {endDate || t('end')}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearFilter}
                        className="h-5 w-5 p-0 hover:bg-destructive/10"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  {/* 快捷时间按钮 - 点击立即生效 */}
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setQuickTimeRange('1m')} 
                    disabled={loading}
                    className="h-9 text-xs px-3"
                  >
                    {t('past1Month')}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setQuickTimeRange('3m')} 
                    disabled={loading}
                    className="h-9 text-xs px-3"
                  >
                    {t('past3Months')}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setQuickTimeRange('6m')} 
                    disabled={loading}
                    className="h-9 text-xs px-3"
                  >
                    {t('past6Months')}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setQuickTimeRange('1y')} 
                    disabled={loading}
                    className="h-9 text-xs px-3"
                  >
                    {t('past1Year')}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setQuickTimeRange('ytd')} 
                    disabled={loading}
                    className="h-9 text-xs px-3"
                  >
                    {t('yearToDate')}
                  </Button>
                  
                  {/* 自定义日期 Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-9 text-xs px-3"
                        disabled={loading}
                      >
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        {t('customRange')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-4" align="end">
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="start-date" className="text-xs">{t('startDate')}</Label>
                          <Input
                            id="start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="end-date" className="text-xs">{t('endDate')}</Label>
                          <Input
                            id="end-date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={applyFilter}
                            disabled={loading}
                            className="flex-1"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                {t('loading')}
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1" />
                                {t('applyFilter')}
                              </>
                            )}
                          </Button>
                          {(startDate || endDate) && (
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setStartDate("")
                                setEndDate("")
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
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
                  totalStats.total_profit >= 0 ? 'text-red-600' : 'text-green-600'
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
                  <span className="text-red-600">{totalStats.winning_stocks} {t('profit')}</span>
                  {' / '}
                  <span className="text-green-600">{totalStats.losing_stocks} {t('loss')}</span>
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
              <div className="space-y-6">
                {/* 盈亏柱状图 - 分成盈利和亏损两部分，上下两行显示 */}
                <div className="space-y-4">
                  {/* 盈利柱状图 - 第一行 */}
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-red-600">
                      <TrendingUp className="h-4 w-4" />
                      {t('profitStocks')} ({stockSummary.filter(s => s.realized_profit > 0).length})
                      <span className="text-xs text-muted-foreground font-normal ml-2">
                        ({t('topStocks', { count: Math.min(30, stockSummary.filter(s => s.realized_profit > 0).length) })})
                      </span>
                    </h3>
                    <div className="h-64">
                      <ProfitBarChart data={stockSummary} type="profit" />
                    </div>
                  </div>
                  
                  {/* 亏损柱状图 - 第二行 */}
                  <div className="bg-secondary/30 rounded-lg p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-green-600">
                      <TrendingDown className="h-4 w-4" />
                      {t('lossStocks')} ({stockSummary.filter(s => s.realized_profit < 0).length})
                      <span className="text-xs text-muted-foreground font-normal ml-2">
                        ({t('topStocks', { count: Math.min(30, stockSummary.filter(s => s.realized_profit < 0).length) })})
                      </span>
                    </h3>
                    <div className="h-64">
                      <ProfitBarChart data={stockSummary} type="loss" />
                    </div>
                  </div>
                </div>
                
                {/* 详细表格 - 使用 Tab 切换 */}
                <Tabs defaultValue="profit" className="w-full">
                  <TabsList className="w-full max-w-md mx-auto mb-4">
                    <TabsTrigger 
                      value="profit" 
                      className="flex-1"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      {t('profitStocks')} ({stockSummary.filter(s => s.realized_profit > 0).length})
                    </TabsTrigger>
                    <TabsTrigger 
                      value="loss" 
                      className="flex-1"
                    >
                      <TrendingDown className="h-4 w-4 mr-2" />
                      {t('lossStocks')} ({stockSummary.filter(s => s.realized_profit < 0).length})
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* 盈利列表 */}
                  <TabsContent value="profit">
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
                          {stockSummary
                            .filter(s => s.realized_profit > 0)
                            .sort((a, b) => b.realized_profit - a.realized_profit)
                            .map((stock, index) => (
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
                                {formatCurrency(stock.total_buy_amount, stock.currency)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(stock.total_sell_amount, stock.currency)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <TrendingUp className="h-4 w-4 text-red-600" />
                                  <span className="font-mono font-semibold text-red-600">
                                    +{formatCurrency(stock.realized_profit, 'USD')}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-mono font-semibold text-red-600">
                                  +{stock.profit_rate.toFixed(2)}%
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
                  </TabsContent>
                  
                  {/* 亏损列表 */}
                  <TabsContent value="loss">
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
                          {stockSummary
                            .filter(s => s.realized_profit < 0)
                            .sort((a, b) => a.realized_profit - b.realized_profit)
                            .map((stock, index) => (
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
                            {formatCurrency(stock.total_buy_amount, stock.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(stock.total_sell_amount, stock.currency)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                                  <TrendingDown className="h-4 w-4 text-green-600" />
                                  <span className="font-mono font-semibold text-green-600">
                                    {formatCurrency(stock.realized_profit, 'USD')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                                <span className="font-mono font-semibold text-green-600">
                                  {stock.profit_rate.toFixed(2)}%
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
                  </TabsContent>
                </Tabs>
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
                    <p className="font-mono font-semibold">{formatPrice(selectedStock.avg_buy_price, selectedStock.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('avgSellPrice')}</p>
                    <p className="font-mono font-semibold">{formatPrice(selectedStock.avg_sell_price, selectedStock.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('totalFees')}</p>
                    <p className="font-mono font-semibold">{formatCurrency(selectedStock.total_fees, selectedStock.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('realizedProfit')}</p>
                    <p className={`font-mono font-semibold ${
                      selectedStock.realized_profit >= 0 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {selectedStock.realized_profit >= 0 ? '+' : ''}{formatCurrency(selectedStock.realized_profit, 'USD')}
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
                              {trade.filled_price ? formatPrice(trade.filled_price, trade.currency) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {trade.filled_amount ? formatCurrency(trade.filled_amount, trade.currency) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {formatCurrency(trade.total_fee || 0, trade.currency)}
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

