"use client"

import { useAuth } from '@/lib/auth-context'
import { useTranslations } from 'next-intl'

export function WelcomeMessage() {
  const { user, isLoading } = useAuth()
  const t = useTranslations('auth')
  
  if (isLoading) {
    return null
  }
  
  if (!user) {
    return null
  }
  
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <p className="text-sm text-foreground">
          <span className="font-medium">{t('welcome')}</span>{' '}
          <span className="text-primary">{user.email}</span>
        </p>
      </div>
    </div>
  )
}

