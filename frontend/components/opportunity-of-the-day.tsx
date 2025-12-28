"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ExternalLink, Lightbulb } from "lucide-react"
import { useAuth } from '@/lib/auth-context'
import { useTranslations } from 'next-intl'

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

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

interface OpportunityOfTheDayProps {
  selectedOpportunity?: InvestmentOpportunity | null
  onOpportunityChange?: number | (() => void)
}

export function OpportunityOfTheDay({ selectedOpportunity, onOpportunityChange }: OpportunityOfTheDayProps = {}) {
  const { session } = useAuth()
  const t = useTranslations('opportunity')
  const [opportunity, setOpportunity] = useState<InvestmentOpportunity | null>(null)
  const [loading, setLoading] = useState(true)

  // 获取认证头
  const getAuthHeaders = () => {
    return {
      'Authorization': `Bearer ${session?.access_token}`,
    }
  }

  // 加载最新的投资机会
  const loadLatestOpportunity = async () => {
    if (!session?.access_token) {
      setLoading(false)
      return
    }

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

  useEffect(() => {
    if (selectedOpportunity) {
      setOpportunity(selectedOpportunity)
      setLoading(false)
    } else if (session?.access_token) {
      loadLatestOpportunity()
    } else {
      setLoading(false)
    }
  }, [session?.access_token, selectedOpportunity])

  // 当机会更新时，重新加载
  useEffect(() => {
    if (onOpportunityChange !== undefined && !selectedOpportunity && session?.access_token) {
      loadLatestOpportunity()
    }
  }, [onOpportunityChange, selectedOpportunity, session?.access_token])

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

          {opportunity.stock_name && (
            <div className="pt-6 border-t space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-lg">{opportunity.stock_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {opportunity.stock_code} • {opportunity.market === 'A' ? t('marketA') : t('marketHK')}
                  </div>
                </div>
                {opportunity.current_price && (
                  <div className="text-right">
                    <div className="text-2xl font-bold">¥{opportunity.current_price.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{t('currentPrice')}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
