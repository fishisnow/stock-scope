"use client"

import Image from "next/image"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Link } from "@/i18n/routing"
import { ArrowRight, BarChart3, BookOpenText, Radar, Sparkles, Target, Trophy } from "lucide-react"
import { useTranslations } from "next-intl"

export default function LandingPage() {
  const t = useTranslations("landingV2")
  const previewCards = [
    {
      title: t("preview.cards.opportunity.title"),
      description: t("preview.cards.opportunity.description"),
      icon: Target,
      href: "/home",
      tag: t("preview.cards.opportunity.tag"),
      image: "/invest-opertunities.png",
      imageAlt: t("preview.cards.opportunity.imageAlt"),
    },
    {
      title: t("preview.cards.breadth.title"),
      description: t("preview.cards.breadth.description"),
      icon: Radar,
      href: "/market",
      tag: t("preview.cards.breadth.tag"),
      image: "/market-breadth.png",
      imageAlt: t("preview.cards.breadth.imageAlt"),
    },
    {
      title: t("preview.cards.list.title"),
      description: t("preview.cards.list.description"),
      icon: Trophy,
      href: "/market/industry",
      tag: t("preview.cards.list.tag"),
      image: "/stock-list.png",
      imageAlt: t("preview.cards.list.imageAlt"),
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="relative overflow-hidden">
        <section className="relative min-h-[calc(100vh-4rem)] border-b border-border/50 bg-[radial-gradient(circle_at_10%_20%,rgba(59,130,246,0.14),transparent_38%),radial-gradient(circle_at_90%_10%,rgba(99,102,241,0.12),transparent_35%),radial-gradient(circle_at_50%_95%,rgba(59,130,246,0.08),transparent_45%)]">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.14)_1px,transparent_1px)] bg-[size:34px_34px] [mask-image:radial-gradient(circle_at_center,black,transparent_78%)]" />

          <div className="container relative mx-auto flex min-h-[calc(100vh-4rem)] flex-col justify-center px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                {t("hero.badge")}
              </div>
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
                {t("hero.titlePrefix")}
                <span className="bg-gradient-to-r from-primary via-blue-500 to-indigo-500 bg-clip-text text-transparent"> {t("hero.titleHighlight")}</span>
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {t("hero.subtitle")}
              </p>
            </div>

            <div className="mx-auto mt-10 grid w-full max-w-5xl gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/65 bg-background/75 p-4 shadow-sm backdrop-blur-sm">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Target className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium">{t("hero.features.fastDiscovery.title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("hero.features.fastDiscovery.description")}</p>
              </div>
              <div className="rounded-xl border border-border/65 bg-background/75 p-4 shadow-sm backdrop-blur-sm">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium">{t("hero.features.clearSignals.title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("hero.features.clearSignals.description")}</p>
              </div>
              <div className="rounded-xl border border-border/65 bg-background/75 p-4 shadow-sm backdrop-blur-sm">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <BookOpenText className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium">{t("hero.features.fullReview.title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t("hero.features.fullReview.description")}</p>
              </div>
            </div>

            <div className="mx-auto mt-10 flex w-full max-w-4xl flex-wrap items-center justify-center gap-3">
              <Button className="gap-2" asChild>
                <Link href="/home">
                {t("hero.primaryCta")}
                <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="content-preview" className="container mx-auto scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-9 max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">{t("preview.badge")}</p>
            <h2 className="mt-2 text-xl font-semibold sm:text-2xl lg:text-3xl md:whitespace-nowrap">{t("preview.title")}</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("preview.description")}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 lg:gap-7">
            {previewCards.map((card) => {
              const Icon = card.icon
              return (
                <article key={card.title} className="group rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <h3 className="text-base font-semibold">{card.title}</h3>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{card.tag}</span>
                  </div>

                  <div className="relative mb-3 aspect-video overflow-hidden rounded-xl border border-border/70 bg-muted/35">
                    <Image
                      src={card.image}
                      alt={card.imageAlt}
                      fill
                      className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
                      sizes="(min-width: 1024px) 30vw, (min-width: 768px) 33vw, 100vw"
                    />
                  </div>

                  <p className="text-sm text-muted-foreground">{card.description}</p>
                  <Button asChild variant="ghost" className="mt-3 px-0 text-primary hover:bg-transparent hover:text-primary/80 group-hover:translate-x-0.5">
                    <Link href={card.href}>
                      {t("preview.cardCta")}
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </article>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
