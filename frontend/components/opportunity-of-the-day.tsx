"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ExternalLink, Lightbulb, TrendingUp, ChevronRight, Lock } from "lucide-react"
import { useAuth } from '@/lib/auth-context'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/routing'

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

interface OpportunityOfTheDayProps {
  selectedOpportunity?: InvestmentOpportunity | null
  onOpportunityChange?: number | (() => void)
  isLatest?: boolean // 标识是否为最新的投资机会
}

export function OpportunityOfTheDay({ selectedOpportunity, onOpportunityChange, isLatest = true }: OpportunityOfTheDayProps = {}) {
  const { session } = useAuth()
  const t = useTranslations('opportunity')
  const router = useRouter()
  const pathname = usePathname()
  const [opportunity, setOpportunity] = useState<InvestmentOpportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const isAuthenticated = !!session?.access_token

  // 获取认证头（仅在已登录时添加）
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {}
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`
    }
    return headers
  }

  // 加载最新的投资机会（未登录用户也可以加载）
  const loadLatestOpportunity = async () => {
    try {
      const response = await fetch(`${API_URL}/api/investment-opportunities?page=1&limit=1`, {
        headers: getAuthHeaders()
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      if (result.success && result.data && result.data.length > 0) {
        setOpportunity(result.data[0])
      }
    } catch (error) {
      console.error('加载投资机会失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 处理未登录用户点击股票卡片
  const handleStockCardClick = (stock: StockInfo) => {
    if (!isAuthenticated) {
      // 跳转到首页并添加登录参数
      const currentPath = pathname || '/'
      router.push(`${currentPath}?login=true`)
      // 触发自定义事件来打开登录对话框
      window.dispatchEvent(new CustomEvent('openLoginDialog'))
    } else {
      // 已登录用户正常跳转
      window.location.href = `/market?code=${stock.stock_code}&market=${stock.market}`
    }
  }

  useEffect(() => {
    if (selectedOpportunity) {
      setOpportunity(selectedOpportunity)
      setLoading(false)
    } else {
      loadLatestOpportunity()
    }
  }, [selectedOpportunity])

  // 当机会更新时，重新加载
  useEffect(() => {
    if (onOpportunityChange !== undefined && !selectedOpportunity) {
      loadLatestOpportunity()
    }
  }, [onOpportunityChange, selectedOpportunity])

  if (loading) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center">
            <div className="animate-pulse">{t('loading')}</div>
          </div>
        </div>
      </section>
    )
  }

  if (!opportunity) {
    return (
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center">
            <Lightbulb className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-primary mb-4 text-balance">
              {t('title')}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t('noOpportunityDesc')}
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary mb-6">
            <Lightbulb className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{t('subtitle')}</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-primary mb-8 text-balance">
            {t('title')}
          </h1>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-8">
            <Calendar className="h-4 w-4" />
            <span>{new Date(opportunity.recorded_at).toLocaleDateString(undefined, { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</span>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="font-serif text-3xl sm:text-4xl text-foreground leading-tight text-balance">
            {opportunity.core_idea}
          </h2>

          {opportunity.source_url && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium">{t('source')}：</span>
              <a
                href={opportunity.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                <span className="truncate max-w-md">{opportunity.source_url}</span>
                <ExternalLink className="h-3 w-3 flex-shrink-0" />
              </a>
            </div>
          )}

          {opportunity.trigger_words && opportunity.trigger_words.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {opportunity.trigger_words.map((word, index) => (
                <Badge key={index} variant="secondary" className="text-sm">
                  {word}
                </Badge>
              ))}
            </div>
          )}

          {opportunity.summary && (
            <div className="prose prose-lg max-w-none space-y-4 text-foreground/90 leading-relaxed">
              <p className="whitespace-pre-wrap">{opportunity.summary}</p>
            </div>
          )}

          {opportunity.stocks && opportunity.stocks.length > 0 && (
            <div className="pt-6 border-t">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  <div className="font-semibold text-lg">{t('relatedStocks') || '关联股票'}</div>
                </div>
                <p className="text-sm text-muted-foreground ml-7">
                  {t('relatedStocksDesc') || '该投资机会可能受益的相关标的'}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...opportunity.stocks]
                  .sort((a, b) => {
                    // 按涨幅降序排序，涨幅大的在前
                    const ratioA = a.price_change_ratio ?? -Infinity
                    const ratioB = b.price_change_ratio ?? -Infinity
                    return ratioB - ratioA
                  })
                  .map((stock, index) => {
                    const priceChangeRatio = stock.price_change_ratio ?? 0
                    const isPositive = priceChangeRatio > 0
                    const isNegative = priceChangeRatio < 0
                    const isNeutral = priceChangeRatio === 0
                    const isHighGain = priceChangeRatio > 10
                    const recordedPrice = stock.current_price
                    const latestPrice = stock.latest_price
                    const pricesEqual = recordedPrice !== null && recordedPrice !== undefined &&
                                       latestPrice !== null && latestPrice !== undefined && 
                                       Math.abs(recordedPrice - latestPrice) < 0.01

                    return (
                      <div
                        key={index}
                        className={`p-4 bg-card border rounded-lg transition-all cursor-pointer group relative ${
                          isHighGain ? 'border-primary/30 bg-primary/5' : 'hover:shadow-lg hover:border-primary/20'
                        } ${!isAuthenticated && !isLatest ? 'blur-[2px]' : ''}`}
                        onClick={() => handleStockCardClick(stock)}
                      >
                        <div className="space-y-3">
                          {/* 主视觉：股票名称 + 涨幅 */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-bold text-lg mb-1">{stock.stock_name}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{stock.stock_code}</span>
                                <span>•</span>
                                <span>{stock.market === 'A' ? t('marketA') : t('marketHK')}</span>
                              </div>
                            </div>
                            {isAuthenticated && priceChangeRatio !== null && priceChangeRatio !== undefined && (
                              <div className={`text-2xl font-bold ${
                                isPositive ? 'text-red-600' : 
                                isNegative ? 'text-green-600' : 
                                'text-muted-foreground'
                              }`}>
                                {isNeutral ? '' : isPositive ? '+' : ''}{priceChangeRatio.toFixed(2)}%
                              </div>
                            )}
                            {!isAuthenticated && (
                              <div className="text-2xl font-bold text-muted-foreground">
                                •••
                              </div>
                            )}
                            {isAuthenticated && (
                              <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            )}
                          </div>
                          
                          {/* 价格信息：智能显示（仅已登录用户可见） */}
                          {isAuthenticated && (recordedPrice !== null && recordedPrice !== undefined) && (
                            <div className="pt-2">
                              {pricesEqual ? (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-muted-foreground">{t('recordedPrice') || '记录价'}</span>
                                  <span className="font-medium">¥{recordedPrice.toFixed(2)}</span>
                                </div>
                              ) : (
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">{t('recordedPrice') || '记录价'}</span>
                                    <span className="font-medium">¥{recordedPrice.toFixed(2)}</span>
                                  </div>
                                  {latestPrice !== null && latestPrice !== undefined && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-muted-foreground">{t('latestPrice') || '最新价'}</span>
                                      <span className="font-medium">¥{latestPrice.toFixed(2)}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        {/* 未登录用户的底部引导 */}
        {!isAuthenticated && (
          <div className="mt-12 p-6 bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-xl text-center">
            <Lock className="h-10 w-10 text-primary mx-auto mb-3" />
            <h3 className="text-xl font-semibold text-primary mb-2">
              {t('loginToViewStocksTitle') || '解锁完整投资机会'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('loginToViewStocksDesc') || '登录后查看更多投资机会，记录你的投资灵感"'}
            </p>
            <Button 
              onClick={() => {
                const currentPath = pathname || '/'
                router.push(`${currentPath}?login=true`)
                window.dispatchEvent(new CustomEvent('openLoginDialog'))
              }}
              className="gap-2"
            >
              <span>{t('loginNow') || '立即登录'}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
