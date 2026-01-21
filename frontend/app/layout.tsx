import type { ReactNode } from "react"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Playfair_Display } from "next/font/google"
import { getLocale } from "next-intl/server"
import { routing } from "@/i18n/routing"
import { AuthProvider } from "@/lib/auth-context"
import "./globals.css"

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
})

export default async function RootLayout({ children }: { children: ReactNode }) {
  let locale: (typeof routing.locales)[number] = routing.defaultLocale
  try {
    const resolvedLocale = await getLocale()
    if (
      routing.locales.includes(
        resolvedLocale as (typeof routing.locales)[number]
      )
    ) {
      locale = resolvedLocale as (typeof routing.locales)[number]
    }
  } catch {
    // Fallback to default locale for non-i18n routes like /auth/callback
  }

  return (
    <html lang={locale}>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} ${playfair.variable}`}
        suppressHydrationWarning
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}

