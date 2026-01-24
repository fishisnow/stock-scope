"use client"

import { useState } from "react"
import { Header } from "@/components/header"
import { OpportunityOfTheDay } from "@/components/opportunity-of-the-day"
// import { TrendsSection } from "@/components/trends-section"
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

export default function Home() {
  const [opportunityChangeTrigger, setOpportunityChangeTrigger] = useState(0)
  const [recorderOpen, setRecorderOpen] = useState(false)
  const [editingOpportunity, setEditingOpportunity] = useState<InvestmentOpportunity | null>(null)

  const handleOpportunityChange = () => {
    setOpportunityChangeTrigger(prev => prev + 1)
  }

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
      <Header onRecordOpportunity={handleOpenRecorder} />
      <main>
        <OpportunityOfTheDay 
          onOpportunityChange={opportunityChangeTrigger}
        />
        {/* <TrendsSection /> */}
        <OpportunitiesDatabase 
          onOpportunityChange={handleOpportunityChange}
          onOpenRecorder={handleOpenRecorder}
          onEditOpportunity={handleEditOpportunity}
        />
        <InvestmentOpportunityRecorder 
          onOpportunityChange={handleOpportunityChange}
          initialEditingOpportunity={editingOpportunity}
          onEditComplete={handleEditComplete}
          open={recorderOpen}
          onOpenChange={setRecorderOpen}
        />
      </main>
    </div>
  )
}
