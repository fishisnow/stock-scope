import type React from "react"
import type { Metadata } from "next"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { NextIntlClientProvider } from "next-intl"
import { getMessages } from "next-intl/server"
import { routing } from "@/i18n/routing"
import { notFound } from "next/navigation"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "StockScope - AI-Powered Investment Opportunities",
  description: "Discover emerging stock investment opportunities powered by AI",
  generator: "v0.app",
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  
  // Ensure that the incoming `locale` is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <Suspense fallback={null}>{children}</Suspense>
      <Toaster />
      <Analytics />
    </NextIntlClientProvider>
  )
}

