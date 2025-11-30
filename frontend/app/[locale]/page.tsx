import { Header } from "@/components/header"
import { OpportunityOfTheDay } from "@/components/opportunity-of-the-day"
import { TrendsSection } from "@/components/trends-section"
import { OpportunitiesDatabase } from "@/components/opportunities-database"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <OpportunityOfTheDay />
        <TrendsSection />
        <OpportunitiesDatabase />
      </main>
    </div>
  )
}

