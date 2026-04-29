"use client"

import React from 'react'
import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('footer')

  return (
    <footer className="border-t border-border bg-background">
      <div className="container mx-auto flex items-center justify-center px-4 py-6 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a
            href="https://github.com/fishisnow/stock-scope"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="mailto:fishisnow2021@gmail.com"
            className="hover:text-foreground transition-colors"
          >
            {t('contact')}
          </a>
          <span aria-hidden="true">·</span>
          <span>{t('copyright')}</span>
        </div>
      </div>
    </footer>
  )
}
