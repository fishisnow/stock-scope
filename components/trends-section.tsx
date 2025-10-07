import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendChart } from "@/components/trend-chart"
import { ArrowUp, Info } from "lucide-react"

const trends = [
  {
    title: "AI Semiconductor Supply Chain",
    volume: "8.2K",
    growth: "+425%",
    description:
      "Companies manufacturing specialized chips for AI workloads are seeing explosive demand as enterprises race to deploy AI infrastructure.",
    data: [20, 22, 25, 28, 32, 38, 45, 55, 70, 95, 105],
  },
  {
    title: "Weight Loss Drug Manufacturers",
    volume: "12.5K",
    growth: "+380%",
    description:
      "GLP-1 drug manufacturers experiencing unprecedented growth as obesity treatment market expands globally.",
    data: [15, 16, 15, 17, 18, 22, 35, 48, 58, 62, 57],
  },
  {
    title: "Quantum Computing Hardware",
    volume: "3.1K",
    growth: "+290%",
    description:
      "Early-stage quantum computing companies gaining traction as technology moves from research to commercial applications.",
    data: [10, 11, 12, 13, 15, 18, 22, 28, 35, 39, 39],
  },
  {
    title: "Cybersecurity Infrastructure",
    volume: "15.8K",
    growth: "+185%",
    description:
      "Enterprise cybersecurity providers benefiting from increased digital threats and regulatory compliance requirements.",
    data: [30, 32, 35, 38, 42, 48, 55, 65, 75, 82, 86],
  },
  {
    title: "Electric Vehicle Charging",
    volume: "6.4K",
    growth: "+220%",
    description:
      "EV charging infrastructure companies positioned for growth as electric vehicle adoption accelerates worldwide.",
    data: [18, 20, 22, 25, 30, 38, 48, 58, 62, 58, 58],
  },
  {
    title: "Space Technology Services",
    volume: "2.9K",
    growth: "+310%",
    description:
      "Commercial space companies providing satellite services and launch capabilities seeing increased demand.",
    data: [8, 9, 10, 12, 15, 20, 28, 35, 38, 33, 33],
  },
  {
    title: "Precision Agriculture Tech",
    volume: "4.7K",
    growth: "+165%",
    description:
      "Agricultural technology companies using AI and IoT to optimize crop yields and reduce resource consumption.",
    data: [25, 26, 28, 30, 33, 38, 45, 52, 58, 63, 66],
  },
  {
    title: "Longevity Biotech",
    volume: "5.3K",
    growth: "+275%",
    description:
      "Biotechnology companies focused on extending human healthspan through cellular rejuvenation and anti-aging therapies.",
    data: [12, 13, 14, 16, 20, 26, 34, 42, 45, 45, 45],
  },
]

export function TrendsSection() {
  return (
    <section id="trends" className="py-16 px-4 sm:px-6 lg:px-8 bg-secondary/30">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="font-serif text-5xl sm:text-6xl text-primary mb-4">Trends</h2>
          <p className="text-lg text-muted-foreground">Discover emerging investment trends and opportunities</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {trends.map((trend, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold leading-tight text-balance">{trend.title}</CardTitle>
                <div className="flex items-center gap-4 pt-2">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-primary">{trend.volume}</span>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex items-center gap-1 text-green-600">
                    <ArrowUp className="h-3 w-3" />
                    <span className="text-sm font-semibold">{trend.growth}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-24">
                  <TrendChart data={trend.data} />
                </div>
                <CardDescription className="text-sm leading-relaxed">{trend.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
