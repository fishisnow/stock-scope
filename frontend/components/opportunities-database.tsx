import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const opportunities = [
  {
    title: "Vertical farming automation platform that reduces labor costs by 80% for indoor agriculture ($8M ARR)",
    description:
      "Indoor farming operations struggle with high labor costs that make them uncompetitive with traditional agriculture. Vertical farms spend 40-50% of revenue on labor for planting, monitoring, and harvesting. This automation platform uses computer vision and robotics to handle the entire growing cycle, reducing labor needs by 80% while increasing yield consistency.",
    tags: ["AgTech", "Automation", "High Growth"],
  },
  {
    title: "AI-powered drug discovery platform targeting rare diseases with orphan drug designation ($25M funding)",
    description:
      "Pharmaceutical companies avoid rare disease research due to small patient populations and high development costs. This AI platform identifies drug candidates for rare diseases 10x faster than traditional methods, with built-in regulatory pathway optimization for orphan drug designation. The platform has already identified 3 promising candidates.",
    tags: ["Biotech", "AI", "Healthcare"],
  },
  {
    title: "Carbon capture technology for industrial facilities with 5-year payback period ($50M market)",
    description:
      "Industrial facilities face increasing carbon taxes but existing capture technology has 15-20 year payback periods. This modular carbon capture system achieves 5-year payback through improved efficiency and lower capital costs. Early customers include cement manufacturers and steel producers facing EU carbon border taxes.",
    tags: ["CleanTech", "Industrial", "ESG"],
  },
  {
    title: "Quantum-resistant encryption for financial institutions preparing for post-quantum security ($100M TAM)",
    description:
      "Financial institutions must prepare for quantum computers that will break current encryption within 5-10 years. This quantum-resistant encryption platform provides drop-in replacement for existing systems with minimal performance impact. Regulatory pressure is accelerating adoption as NIST finalizes post-quantum standards.",
    tags: ["Cybersecurity", "FinTech", "Enterprise"],
  },
  {
    title: "Personalized cancer vaccine platform using patient tumor DNA ($2B market opportunity)",
    description:
      "Cancer immunotherapy has shown promise but lacks personalization for individual tumors. This platform sequences patient tumor DNA and manufactures custom mRNA vaccines within 6 weeks. Early clinical trials show 70% response rates in melanoma and lung cancer patients who failed standard treatments.",
    tags: ["Biotech", "Oncology", "Personalized Medicine"],
  },
  {
    title: "Autonomous warehouse robots with 18-month ROI for e-commerce fulfillment centers",
    description:
      "E-commerce fulfillment centers face labor shortages and rising wages while demand continues growing. These autonomous robots handle picking, packing, and sorting with 99.9% accuracy and 18-month payback period. The system integrates with existing warehouse management software and scales incrementally.",
    tags: ["Robotics", "E-commerce", "Logistics"],
  },
]

export function OpportunitiesDatabase() {
  return (
    <section id="database" className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="font-serif text-5xl sm:text-6xl text-primary mb-4">The Opportunity Database</h2>
          <p className="text-lg text-muted-foreground">
            Dive into deep research and analysis on 400+ investment opportunities
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {opportunities.map((opportunity, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardHeader>
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg mb-4 flex items-center justify-center">
                  <div className="text-4xl">📊</div>
                </div>
                <CardTitle className="text-lg font-serif leading-tight text-balance group-hover:text-primary transition-colors">
                  {opportunity.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CardDescription className="text-sm leading-relaxed line-clamp-4">
                  {opportunity.description}
                </CardDescription>
                <div className="flex flex-wrap gap-2">
                  {opportunity.tags.map((tag, tagIndex) => (
                    <Badge key={tagIndex} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
