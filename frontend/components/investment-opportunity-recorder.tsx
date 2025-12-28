"use client"

import { useState, useEffect } from "react"
import { useAuth } from '@/lib/auth-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from 'next-intl'

interface StockInfo {
  code: string
  name: string
  market: string
  current_price?: number
  change_ratio?: number
}

interface InvestmentOpportunity {
  id?: number
  core_idea: string
  source_url: string
  summary: string
  trigger_words: string[]
  stock_name: string
  stock_code: string
  current_price: number | null
  market: string
  recorded_at: string
  created_at?: string
  updated_at?: string
}

interface InvestmentOpportunityRecorderProps {
  onOpportunityChange?: () => void
  initialEditingOpportunity?: InvestmentOpportunity | null
  onEditComplete?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function InvestmentOpportunityRecorder({ 
  onOpportunityChange, 
  initialEditingOpportunity = null,
  onEditComplete,
  open,
  onOpenChange
}: InvestmentOpportunityRecorderProps = {}) {
  const { session } = useAuth()
  const t = useTranslations('opportunity.recorder')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // 如果外部传入 open 和 onOpenChange，使用外部控制
  const dialogOpen = open !== undefined ? open : isDialogOpen
  const setDialogOpen = onOpenChange || setIsDialogOpen
  const [editingOpportunity, setEditingOpportunity] = useState<InvestmentOpportunity | null>(initialEditingOpportunity || null)
  const [formData, setFormData] = useState<Partial<InvestmentOpportunity>>({
    core_idea: "",
    source_url: "",
    summary: "",
    trigger_words: [],
    stock_name: "",
    stock_code: "",
    current_price: null,
    market: "A"
  })
  const [stockSearchQuery, setStockSearchQuery] = useState("")
  const [stockSearchResults, setStockSearchResults] = useState<StockInfo[]>([])
  const [isSearchingStock, setIsSearchingStock] = useState(false)
  const [currentTriggerWord, setCurrentTriggerWord] = useState("")
  const { toast } = useToast()

  // 获取认证头
  const getAuthHeaders = () => {
    return {
      'Authorization': `Bearer ${session?.access_token}`,
    }
  }


  // 搜索股票
  const searchStocks = async (query: string, market?: string) => {
    if (!query.trim()) return

    setIsSearchingStock(true)
    try {
      const params = new URLSearchParams({ query })
      if (market) params.append('market', market)

      const response = await fetch(`${API_URL}/api/stock-analysis/search-stocks?${params}`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()

      if (result.success) {
        setStockSearchResults(result.data)
      }
    } catch (error) {
      console.error('搜索股票失败:', error)
      toast({
        title: "搜索失败",
        description: "无法连接到股票搜索服务",
        variant: "destructive"
      })
    } finally {
      setIsSearchingStock(false)
    }
  }

  // 选择股票
  const selectStock = async (stock: StockInfo) => {
    setFormData(prev => ({
      ...prev,
      stock_name: stock.name,
      stock_code: stock.code,
      market: stock.market
    }))

    // 获取当前股价
    try {
      const response = await fetch(`${API_URL}/api/stock-analysis/get-stock-price?code=${stock.code}&market=${stock.market}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setFormData(prev => ({
            ...prev,
            current_price: result.data.current_price
          }))
        }
      }
    } catch (error) {
      console.error('获取股价失败:', error)
      // 不显示错误提示，因为这是可选功能
    }

    setStockSearchQuery("")
    setStockSearchResults([])
  }

  // 添加触发词
  const addTriggerWord = () => {
    if (currentTriggerWord.trim() && !formData.trigger_words?.includes(currentTriggerWord.trim())) {
      setFormData(prev => ({
        ...prev,
        trigger_words: [...(prev.trigger_words || []), currentTriggerWord.trim()]
      }))
      setCurrentTriggerWord("")
    }
  }

  // 删除触发词
  const removeTriggerWord = (word: string) => {
    setFormData(prev => ({
      ...prev,
      trigger_words: prev.trigger_words?.filter(w => w !== word) || []
    }))
  }

  // 提交表单
  const submitForm = async () => {
    if (!session?.access_token) {
      toast({
        title: t('loginRequired'),
        description: t('loginRequired'),
        variant: "destructive"
      })
      return
    }

    if (!formData.core_idea?.trim()) {
      toast({
        title: t('coreIdeaRequired'),
        description: t('coreIdeaRequired'),
        variant: "destructive"
      })
      return
    }

    try {
      const url = editingOpportunity
        ? `${API_URL}/api/investment-opportunities/${editingOpportunity.id}`
        : `${API_URL}/api/investment-opportunities`

      const method = editingOpportunity ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: editingOpportunity ? t('updateSuccess') : t('createSuccess'),
          description: editingOpportunity ? t('updateSuccess') : t('createSuccess')
        })
        setDialogOpen(false)
        resetForm()
        // 通知父组件更新列表
        if (onOpportunityChange) {
          onOpportunityChange()
        }
        if (onEditComplete) {
          onEditComplete()
        }
      } else {
        toast({
          title: result.error || (editingOpportunity ? t('updateFailed') : t('createFailed')),
          description: result.error || (editingOpportunity ? t('updateFailed') : t('createFailed')),
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('提交失败:', error)
      toast({
        title: "提交失败",
        description: "无法连接到服务器，请检查网络连接",
        variant: "destructive"
      })
    }
  }


  // 重置表单
  const resetForm = () => {
    setFormData({
      core_idea: "",
      source_url: "",
      summary: "",
      trigger_words: [],
      stock_name: "",
      stock_code: "",
      current_price: null,
      market: "A"
    })
    setEditingOpportunity(null)
    setCurrentTriggerWord("")
    setStockSearchQuery("")
    setStockSearchResults([])
  }

  // 编辑投资机会
  const editOpportunity = (opportunity: InvestmentOpportunity) => {
    setEditingOpportunity(opportunity)
    setFormData({
      core_idea: opportunity.core_idea,
      source_url: opportunity.source_url,
      summary: opportunity.summary,
      trigger_words: [...opportunity.trigger_words],
      stock_name: opportunity.stock_name,
      stock_code: opportunity.stock_code,
      current_price: opportunity.current_price,
      market: opportunity.market
    })
    setIsDialogOpen(true)
  }

  // 当对话框打开时，根据 initialEditingOpportunity 决定是编辑还是新增
  useEffect(() => {
    if (dialogOpen) {
      if (initialEditingOpportunity) {
        // 编辑模式：使用传入的数据
        setEditingOpportunity(initialEditingOpportunity)
        setFormData({
          core_idea: initialEditingOpportunity.core_idea,
          source_url: initialEditingOpportunity.source_url,
          summary: initialEditingOpportunity.summary,
          trigger_words: [...initialEditingOpportunity.trigger_words],
          stock_name: initialEditingOpportunity.stock_name,
          stock_code: initialEditingOpportunity.stock_code,
          current_price: initialEditingOpportunity.current_price,
          market: initialEditingOpportunity.market
        })
      } else {
        // 新增模式：重置表单和编辑状态
        setEditingOpportunity(null)
        setFormData({
          core_idea: "",
          source_url: "",
          summary: "",
          trigger_words: [],
          stock_name: "",
          stock_code: "",
          current_price: null,
          market: "A"
        })
        setCurrentTriggerWord("")
        setStockSearchQuery("")
        setStockSearchResults([])
      }
    }
  }, [dialogOpen, initialEditingOpportunity])

  // 打开新增对话框
  const openAddDialog = () => {
    resetForm()
    setDialogOpen(true)
  }


  return (
    <section className="py-8 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        {/* 隐藏的对话框触发器，通过外部按钮控制 */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <div style={{ display: 'none' }} />
          </DialogTrigger>

            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingOpportunity ? t('editTitle') : t('createTitle')}
                </DialogTitle>
                <DialogDescription>
                  {t('description')}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">{t('basicInfo')}</TabsTrigger>
                  <TabsTrigger value="stock">{t('stockInfo')}</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  {/* 核心观点 */}
                  <div className="space-y-2">
                    <Label htmlFor="core_idea">{t('coreIdeaLabel')}</Label>
                    <Input
                      id="core_idea"
                      placeholder={t('coreIdeaPlaceholder')}
                      value={formData.core_idea || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, core_idea: e.target.value }))}
                    />
                  </div>

                  {/* 来源URL */}
                  <div className="space-y-2">
                    <Label htmlFor="source_url">{t('sourceUrlLabel')}</Label>
                    <Input
                      id="source_url"
                      type="url"
                      placeholder={t('sourceUrlPlaceholder')}
                      value={formData.source_url || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, source_url: e.target.value }))}
                    />
                  </div>

                  {/* 概要 */}
                  <div className="space-y-2">
                    <Label htmlFor="summary">{t('summaryLabel')}</Label>
                    <Textarea
                      id="summary"
                      placeholder={t('summaryPlaceholder')}
                      rows={4}
                      value={formData.summary || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                    />
                  </div>

                  {/* 触发词 */}
                  <div className="space-y-2">
                    <Label>{t('triggerWordsLabel')}</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder={t('triggerWordPlaceholder')}
                        value={currentTriggerWord}
                        onChange={(e) => setCurrentTriggerWord(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addTriggerWord()}
                      />
                      <Button type="button" onClick={addTriggerWord} variant="outline">
                        {t('add')}
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.trigger_words?.map((word, index) => (
                        <Badge key={index} variant="secondary" className="gap-1">
                          {word}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => removeTriggerWord(word)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="stock" className="space-y-4">
                  {/* 市场选择 */}
                  <div className="space-y-2">
                    <Label>{t('marketLabel')}</Label>
                    <Select
                      value={formData.market || "A"}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, market: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">{t('marketA')}</SelectItem>
                        <SelectItem value="HK">{t('marketHK')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 股票搜索 */}
                  <div className="space-y-2">
                    <Label>{t('stockNameLabel')}</Label>
                    <div className="relative">
                      <Input
                        placeholder={t('stockSearchPlaceholder')}
                        value={stockSearchQuery}
                        onChange={(e) => {
                          setStockSearchQuery(e.target.value)
                          searchStocks(e.target.value, formData.market)
                        }}
                      />
                      {isSearchingStock && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                        </div>
                      )}
                    </div>

                    {/* 搜索结果 */}
                    {stockSearchResults.length > 0 && (
                      <div className="border rounded-md max-h-40 overflow-y-auto">
                        {stockSearchResults.map((stock, index) => (
                          <div
                            key={index}
                            className="p-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
                            onClick={() => selectStock(stock)}
                          >
                            <div className="font-medium">{stock.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {stock.code} • {stock.market === 'A' ? t('marketA') : t('marketHK')}
                              {stock.change_ratio !== undefined && (
                                <span className={`ml-2 ${stock.change_ratio >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {stock.change_ratio >= 0 ? '+' : ''}{stock.change_ratio.toFixed(2)}%
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 已选择的股票信息 */}
                  {formData.stock_name && (
                    <div className="p-4 bg-muted rounded-md space-y-2">
                      <div className="font-medium">{t('selectedStock')}</div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('stockName')}：</span>
                          {formData.stock_name}
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('stockCode')}：</span>
                          {formData.stock_code}
                        </div>
                        {formData.current_price && (
                          <div>
                            <span className="text-muted-foreground">{t('currentPrice')}：</span>
                            ¥{formData.current_price.toFixed(2)}
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">{t('market')}：</span>
                          {formData.market === 'A' ? t('marketA') : t('marketHK')}
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('cancel')}
                </Button>
                <Button onClick={submitForm}>
                  {editingOpportunity ? t('update') : t('save')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      </div>
    </section>
  )
}
