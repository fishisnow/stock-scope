"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, Trash2, ExternalLink, Plus, TrendingUp, Lock } from "lucide-react"
import { useRouter, usePathname } from '@/i18n/routing'
import { InvestmentOpportunityRecorder } from "./investment-opportunity-recorder"
import { useAuth } from '@/lib/auth-context'
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from 'next-intl'

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

interface StockInfo {
  stock_name: string
  stock_code: string
  current_price: number | null
  market: string
  latest_price?: number | null
  price_change_ratio?: number | null
}

interface InvestmentOpportunity {
  id?: number
  core_idea: string
  source_url: string
  summary: string
  trigger_words: string[]
  stocks: StockInfo[]
  recorded_at: string
  created_at?: string
  updated_at?: string
}

// 截断 URL 显示
const truncateUrl = (url: string, maxLength: number = 50) => {
  if (!url) return ""
  if (url.length <= maxLength) return url
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname
    const path = urlObj.pathname
    if (domain.length + path.length <= maxLength) return url
    return `${domain}${path.substring(0, maxLength - domain.length - 3)}...`
  } catch {
    return url.length > maxLength ? `${url.substring(0, maxLength - 3)}...` : url
  }
}

interface OpportunitiesDatabaseProps {
  onSelectOpportunity?: (opportunity: InvestmentOpportunity) => void
  selectedOpportunityId?: number
  onOpportunityChange?: () => void
  onOpenRecorder?: () => void
  onEditOpportunity?: (opportunity: InvestmentOpportunity) => void
}

export function OpportunitiesDatabase({ onSelectOpportunity, selectedOpportunityId, onOpportunityChange, onOpenRecorder, onEditOpportunity }: OpportunitiesDatabaseProps = {}) {
  const { session } = useAuth()
  const t = useTranslations('opportunity')
  const tRecorder = useTranslations('opportunity.recorder')
  const router = useRouter()
  const pathname = usePathname()
  const [opportunities, setOpportunities] = useState<InvestmentOpportunity[]>([])
  const [mounted, setMounted] = useState(false)
  const { toast } = useToast()
  const isAuthenticated = !!session?.access_token

  // 处理未登录用户点击股票
  const handleStockClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.stopPropagation()
      // 跳转到首页并添加登录参数
      const currentPath = pathname || '/'
      router.push(`${currentPath}?login=true`)
      // 触发自定义事件来打开登录对话框
      window.dispatchEvent(new CustomEvent('openLoginDialog'))
    }
  }

  // 修复 Hydration 错误：等待客户端挂载
  useEffect(() => {
    setMounted(true)
  }, [])

  // 获取认证头（仅在已登录时添加）
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {}
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }

  // 加载投资机会列表（未登录用户也可以加载）
  const loadOpportunities = async () => {
    try {
      const response = await fetch(`${API_URL}/api/investment-opportunities?page=1&limit=100`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      if (result.success) {
        setOpportunities(result.data)
      } else {
        console.error('API返回错误:', result.error)
      }
    } catch (error) {
      console.error('加载投资机会失败:', error)
    }
  }

  // 删除投资机会
  const deleteOpportunity = async (id: number) => {
    if (!session?.access_token) {
      toast({
        title: t('recorder.loginRequired'),
        description: t('recorder.loginRequired'),
        variant: "destructive"
      })
      return
    }

    if (!confirm(t('confirmDelete'))) return

    try {
      const response = await fetch(`${API_URL}/api/investment-opportunities/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: t('deleteSuccess'),
          description: t('deleteSuccess')
        })
        loadOpportunities()
      } else {
        toast({
          title: t('deleteFailed'),
          description: result.error || t('deleteFailed'),
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error('删除失败:', error)
      toast({
        title: t('deleteFailed'),
        description: t('deleteFailed'),
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    // 无论是否登录都加载投资机会（未登录用户会看到隐藏的信息）
    loadOpportunities()
  }, [session?.access_token])

  // 当投资机会记录器添加/更新后，重新加载列表
  const handleOpportunityChange = () => {
    loadOpportunities()
    if (onOpportunityChange) {
      onOpportunityChange()
    }
  }

  return (
    <section id="database" className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        {/* 顶部操作按钮（补充） */}
        {mounted && session?.access_token && (
          <div className="flex justify-end mb-6">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={onOpenRecorder}
            >
              <Plus className="h-4 w-4" />
              {tRecorder('recordNew')}
            </Button>
          </div>
        )}

        {/* 投资机会列表 */}
        {opportunities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {opportunities.map((opportunity, index) => (
              <Card 
                key={opportunity.id} 
                className={`hover:shadow-lg transition-shadow group cursor-pointer relative ${
                  selectedOpportunityId === opportunity.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => {
                  if (onSelectOpportunity) {
                    onSelectOpportunity(opportunity)
                  }
                  // 点击卡片可以滚动到顶部查看详情
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg font-serif leading-tight text-balance group-hover:text-primary transition-colors flex-1 line-clamp-2">
                      {opportunity.core_idea || (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Lock className="h-4 w-4" />
                          <span className="italic">{t('hiddenInfo') || '登录后查看完整信息'}</span>
                        </div>
                      )}
                    </CardTitle>
                    {isAuthenticated && (
                      <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (onEditOpportunity) {
                              onEditOpportunity(opportunity)
                            }
                          }}
                          title={t('edit')}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            opportunity.id && deleteOpportunity(opportunity.id)
                          }}
                          title={t('delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {opportunity.core_idea ? (
                    <>
                      {opportunity.source_url ? (
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">来源：</span>
                          <a
                            href={opportunity.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1 ml-1"
                            title={opportunity.source_url}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="truncate max-w-[200px]">{truncateUrl(opportunity.source_url, 40)}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        </div>
                      ) : null}

                      {opportunity.summary ? (
                        <CardDescription className="text-sm leading-relaxed line-clamp-3">
                          {opportunity.summary}
                        </CardDescription>
                      ) : !isAuthenticated && index > 0 ? (
                        <div className="relative cursor-pointer" onClick={handleStockClick}>
                          <CardDescription className="text-sm leading-relaxed line-clamp-3 blur-[2px] select-none">
                            这是一个投资机会的详细描述内容，包含了核心逻辑和投资理由。登录后即可查看完整内容，了解投资机会的详细分析和相关标的。
                          </CardDescription>
                        </div>
                      ) : null}

                      {opportunity.trigger_words && opportunity.trigger_words.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {opportunity.trigger_words.map((word, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {word}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg text-center">
                      <p className="text-sm text-primary font-medium mb-1">
                        {t('loginToViewStocksTitle') || '解锁完整投资机会'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('loginToViewStocksDesc') || '登录后查看更多投资机会，记录你的投资灵感"'}
                      </p>
                    </div>
                  )}

                  {opportunity.stocks && opportunity.stocks.length > 0 ? (
                    <div className="text-sm pt-2 border-t space-y-2">
                      <div className="flex items-center gap-2 font-medium mb-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span>{t('relatedStocks') || '关联股票'}</span>
                      </div>
                      <div className={`space-y-2 ${!isAuthenticated && index > 0 ? 'blur-[2px]' : ''}`}>
                        {opportunity.stocks.map((stock, stockIndex) => (
                          <div 
                            key={stockIndex} 
                            className={`flex justify-between items-center ${
                              !isAuthenticated ? 'cursor-pointer' : ''
                            }`}
                            onClick={!isAuthenticated ? handleStockClick : undefined}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{stock.stock_name}</span>
                              <Badge variant="outline" className="text-xs">
                                {stock.stock_code}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {stock.market === 'A' ? t('marketA') : t('marketHK')}
                              </span>
                            </div>
                            {isAuthenticated && stock.price_change_ratio !== null && stock.price_change_ratio !== undefined ? (
                              <div className={`text-sm font-semibold ${
                                stock.price_change_ratio > 0 ? 'text-red-600' : 
                                stock.price_change_ratio < 0 ? 'text-green-600' : 
                                'text-muted-foreground'
                              }`}>
                                {stock.price_change_ratio === 0 ? '' : stock.price_change_ratio > 0 ? '+' : ''}
                                {stock.price_change_ratio.toFixed(2)}%
                              </div>
                            ) : !isAuthenticated ? (
                              <div className="text-sm font-semibold text-muted-foreground">
                                •••
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : !isAuthenticated && index > 0 ? (
                    <div className="text-sm pt-2 border-t space-y-2 cursor-pointer" onClick={handleStockClick}>
                      <div className="flex items-center gap-2 font-medium mb-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <span>{t('relatedStocks') || '关联股票'}</span>
                      </div>
                      <div className="space-y-2 blur-[2px] select-none">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">示例股票 {i}</span>
                              <Badge variant="outline" className="text-xs">
                                00000{i}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                A股
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-red-600">
                              +8.88%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 mb-12">
            <h3 className="text-xl font-medium mb-2">{t('noOpportunities')}</h3>
            <p className="text-muted-foreground">
              {t('noOpportunitiesDesc')}
            </p>
          </div>
        )}
      </div>

    </section>
  )
}
