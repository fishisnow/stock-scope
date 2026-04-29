import { Header } from "@/components/header"
import { OpportunityOfTheDay } from "@/components/opportunity-of-the-day"

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <OpportunityOfTheDay opportunityId={id} isLatest={false} />
      </main>
    </div>
  )
}

