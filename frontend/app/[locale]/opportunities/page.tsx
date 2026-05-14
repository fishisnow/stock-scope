"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"

import { Header } from "@/components/header"
import { OpportunityOfTheDay } from "@/components/opportunity-of-the-day"
import { OpportunitiesDatabase } from "@/components/opportunities-database"
import { InvestmentOpportunityRecorder } from "@/components/investment-opportunity-recorder"

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

export default function OpportunitiesPage() {
  const searchParams = useSearchParams()
  const id = searchParams.get("id") || undefined
  const [recorderOpen, setRecorderOpen] = useState(false)
  const [editingOpportunity, setEditingOpportunity] = useState<InvestmentOpportunity | null>(null)

  const handleOpenRecorder = () => {
    setEditingOpportunity(null)
    setRecorderOpen(true)
  }

  const handleEditOpportunity = (opportunity: InvestmentOpportunity) => {
    setEditingOpportunity(opportunity)
    setRecorderOpen(true)
  }

  const handleEditComplete = () => {
    setEditingOpportunity(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onRecordOpportunity={!id ? handleOpenRecorder : undefined} />
      <main>
        {id ? (
          <OpportunityOfTheDay opportunityId={id} isLatest={false} />
        ) : (
          <>
            <OpportunitiesDatabase
              onOpenRecorder={handleOpenRecorder}
              onEditOpportunity={handleEditOpportunity}
              pageSize={9}
              enablePagination
            />
            <InvestmentOpportunityRecorder
              onOpportunityChange={() => {}}
              initialEditingOpportunity={editingOpportunity}
              onEditComplete={handleEditComplete}
              open={recorderOpen}
              onOpenChange={setRecorderOpen}
            />
          </>
        )}
      </main>
    </div>
  )
}
