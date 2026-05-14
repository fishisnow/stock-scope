import type { ReactNode } from "react"
import type { Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Playfair_Display } from "next/font/google"
import Script from "next/script"
import { routing } from "@/i18n/routing"
import { AuthProvider } from "@/lib/auth-context"
import "./globals.css"

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV
  const shouldEnableAnalytics = appEnv !== "development"
  const locale = routing.defaultLocale

  return (
    <html lang={locale}>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} ${playfair.variable}`}
        suppressHydrationWarning
      >
        <AuthProvider>{children}</AuthProvider>
        {shouldEnableAnalytics && (
          <>
            <Script
              src="https://www.googletagmanager.com/gtag/js?id=G-Z78PHBWNLN"
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-Z78PHBWNLN');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  )
}

