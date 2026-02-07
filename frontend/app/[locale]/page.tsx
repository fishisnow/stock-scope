"use client"

import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "@/i18n/routing"
import { Sparkles, LineChart, NotebookPen, ArrowRight, ShieldCheck, Compass } from "lucide-react"
import { useTranslations } from "next-intl"

export default function LandingPage() {
  const t = useTranslations("landing")

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm text-muted-foreground mb-6">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>{t("hero.badge")}</span>
              </div>
              <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-primary mb-6 text-balance">
                {t("hero.title")}
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
                {t("hero.subtitle")}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" className="gap-2" asChild>
                  <Link href="/home">
                    {t("hero.primaryCta")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/market">{t("hero.secondaryCta")}</Link>
                </Button>
              </div>
              <div className="mt-8 text-sm text-muted-foreground">
                {t("hero.note")}
              </div>
            </div>
          </div>
        </section>

        <section id="value" className="py-16 px-4 sm:px-6 lg:px-8 bg-secondary/30">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-primary mb-3">
                {t("value.title")}
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {t("value.subtitle")}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Compass className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="font-serif text-xl">{t("value.items.discovery.title")}</CardTitle>
                  <CardDescription>{t("value.items.discovery.desc")}</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <LineChart className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="font-serif text-xl">{t("value.items.market.title")}</CardTitle>
                  <CardDescription>{t("value.items.market.desc")}</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <NotebookPen className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="font-serif text-xl">{t("value.items.review.title")}</CardTitle>
                  <CardDescription>{t("value.items.review.desc")}</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <section id="workflow" className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
              <div>
                <h2 className="font-serif text-3xl sm:text-4xl text-primary mb-4">
                  {t("workflow.title")}
                </h2>
                <p className="text-muted-foreground mb-8">
                  {t("workflow.subtitle")}
                </p>
                <div className="space-y-4">
                  {(["capture", "analyze", "learn"] as const).map((key, index) => (
                    <Card key={key} className="border-primary/10">
                      <CardContent className="flex items-start gap-4 pt-6">
                        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{t(`workflow.steps.${key}.title`)}</div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t(`workflow.steps.${key}.desc`)}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="bg-card border rounded-2xl p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">{t("workflow.note")}</span>
                </div>
                <h3 className="font-serif text-2xl mb-4">{t("workflow.highlight.title")}</h3>
                <p className="text-muted-foreground mb-6">{t("workflow.highlight.desc")}</p>
                <Button variant="outline" className="gap-2" asChild>
                  <Link href="/home">
                    {t("workflow.highlight.cta")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="modules" className="py-16 px-4 sm:px-6 lg:px-8 bg-secondary/30">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl sm:text-4xl text-primary mb-3">
                {t("modules.title")}
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                {t("modules.subtitle")}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="font-serif text-xl">{t("modules.items.opportunity.title")}</CardTitle>
                  <CardDescription>{t("modules.items.opportunity.desc")}</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="font-serif text-xl">{t("modules.items.market.title")}</CardTitle>
                  <CardDescription>{t("modules.items.market.desc")}</CardDescription>
                </CardHeader>
              </Card>
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="font-serif text-xl">{t("modules.items.review.title")}</CardTitle>
                  <CardDescription>{t("modules.items.review.desc")}</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="container mx-auto max-w-4xl text-center">
            <h2 className="font-serif text-3xl sm:text-4xl text-primary mb-4">
              {t("cta.title")}
            </h2>
            <p className="text-muted-foreground mb-8">
              {t("cta.subtitle")}
            </p>
            <Button size="lg" className="gap-2" asChild>
              <Link href="/home">
                {t("cta.button")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  )
}
