import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ChevronLeft, ChevronRight, Sparkles, Target } from "lucide-react"

export function OpportunityOfTheDay() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary mb-6">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI-Powered Stock Analysis & Investment Opportunities</span>
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-primary mb-8 text-balance">
            Opportunity of the Day
          </h1>

          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground mb-8">
            <button className="flex items-center gap-2 hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Oct 7, 2025</span>
            </div>
            <button className="flex items-center gap-2 hover:text-foreground transition-colors">
              Next Opportunity
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-3 mb-8">
            <Button variant="outline" size="sm" className="gap-2 bg-transparent">
              <Target className="h-4 w-4" />
              Opportunity Actions
            </Button>
            <Button variant="ghost" size="sm">
              Save
            </Button>
            <Button variant="ghost" size="sm">
              Share
            </Button>
            <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
              <Sparkles className="h-4 w-4" />
              Analyze with AI
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="font-serif text-3xl sm:text-4xl text-foreground leading-tight text-balance">
            Renewable energy infrastructure companies positioned for 300% growth as global climate policies accelerate
            ($15B market)
          </h2>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-amber-100 text-amber-900 hover:bg-amber-100">
              ⏰ Perfect Timing
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-900 hover:bg-blue-100">
              ⚡ Market Catalyst
            </Badge>
            <Badge variant="secondary" className="bg-green-100 text-green-900 hover:bg-green-100">
              👍 Strong Fundamentals
            </Badge>
            <Badge variant="secondary" className="bg-purple-100 text-purple-900 hover:bg-purple-100">
              +12 More
            </Badge>
          </div>

          <div className="prose prose-lg max-w-none space-y-4 text-foreground/90 leading-relaxed">
            <p>
              Global governments are accelerating renewable energy mandates with unprecedented urgency. The EU's
              REPowerEU plan, US Inflation Reduction Act, and China's carbon neutrality goals are creating a perfect
              storm of demand for renewable infrastructure companies. Solar, wind, and battery storage installations are
              projected to triple by 2030, but the supply chain is severely constrained.
            </p>

            <p>
              Companies specializing in renewable energy infrastructure—particularly those manufacturing inverters,
              grid-scale batteries, and smart grid technology—are experiencing explosive growth. The sector is seeing
              40-60% year-over-year revenue increases, yet many stocks remain undervalued compared to traditional energy
              companies. The total addressable market is expanding from $500B to $15T over the next decade.
            </p>

            <p>
              Key investment thesis: Focus on companies with (1) proprietary technology in energy storage or grid
              management, (2) established relationships with utility companies, (3) manufacturing capacity in multiple
              geographies to avoid supply chain risks, and (4) strong balance sheets to weather the capital-intensive
              growth phase. The window for early-stage investment is closing as institutional investors begin rotating
              capital from fossil fuels.
            </p>

            <p>
              Target companies include mid-cap manufacturers trading at 15-20x forward earnings (vs. 25-30x for
              comparable tech companies), with gross margins above 35% and revenue visibility through 2027. The
              risk-reward profile is exceptional for investors willing to hold through the 3-5 year infrastructure
              buildout cycle.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
