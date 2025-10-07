import { Header } from "@/frontend/components/header"
import { OpportunityOfTheDay } from "@/frontend/components/opportunity-of-the-day"
import { TrendsSection } from "@/frontend/components/trends-section"
import { OpportunitiesDatabase } from "@/frontend/components/opportunities-database"

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
