import Link from "next/link"
import { Button } from "@/components/ui/button"
import { TrendingUp } from "lucide-react"

export function Header() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <Link href="/" className="text-xl font-semibold">
              StockScope
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="#opportunities" className="text-sm font-medium hover:text-primary transition-colors">
              Browse Opportunities
            </Link>
            <Link href="#trends" className="text-sm font-medium hover:text-primary transition-colors">
              Trends
            </Link>
            <Link href="#database" className="text-sm font-medium hover:text-primary transition-colors">
              Database
            </Link>
            <Link href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm">
              Login
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
