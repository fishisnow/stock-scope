"use client"

import { AtrStopLossCalculator } from "@/components/atr-stop-loss-calculator"
import { HoldingPainIndexCalculator } from "@/components/holding-pain-index-calculator"
import { LeaderMetricsBoard } from "@/components/leader-metrics-board"
import { PegPaybackCalculator } from "@/components/peg-payback-calculator"
import { Header } from "@/components/header"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="relative overflow-hidden">
        <section
          id="calculators"
          className="border-b border-border/50 bg-background/95 px-4 py-8 sm:px-6 lg:px-10 lg:py-10"
        >
          <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start xl:gap-8">
            <AtrStopLossCalculator />
            <PegPaybackCalculator />
            <HoldingPainIndexCalculator />
          </div>
        </section>

        <LeaderMetricsBoard />
      </main>
    </div>
  )
}
