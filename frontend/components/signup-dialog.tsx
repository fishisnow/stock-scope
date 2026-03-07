"use client"

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from '@/lib/auth-context'

interface SignupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSwitchToLogin: () => void
}

export function SignupDialog({ open, onOpenChange, onSwitchToLogin }: SignupDialogProps) {
  const t = useTranslations('auth')
  const { signup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setError('')
      setSuccessMessage('')
      setIsLoading(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')

    // 验证密码匹配
    if (password !== confirmPassword) {
      setError(t('passwordMismatch'))
      return
    }

    setIsLoading(true)

    try {
      const result = await signup(email, password)
      if (result.needsEmailVerification) {
        setSuccessMessage(t('verificationEmailSent', { email }))
        setPassword('')
        setConfirmPassword('')
        return
      }

      onOpenChange(false)
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      if (err instanceof Error && err.message === 'EMAIL_ALREADY_REGISTERED') {
        setError(t('emailAlreadyRegistered'))
      } else {
        setError(err instanceof Error ? err.message : t('signupFailed'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('signupTitle')}</DialogTitle>
          <DialogDescription>
            {t('signupDescription')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="signup-email">{t('email')}</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">{t('password')}</Label>
            <Input
              id="signup-password"
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder={t('confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-md">
              {successMessage}
            </div>
          )}
          <Button 
            type="submit" 
            className="w-full bg-primary hover:bg-primary/90"
            disabled={isLoading}
          >
            {isLoading ? t('signingUp') : t('signupButton')}
          </Button>
        </form>
        {successMessage && (
          <Button
            type="button"
            variant="outline"
            className="w-full mt-3"
            onClick={() => {
              onOpenChange(false)
              onSwitchToLogin()
            }}
          >
            {t('goToLoginAfterVerify')}
          </Button>
        )}
        <div className="mt-4 text-center text-sm">
          <span className="text-muted-foreground">{t('hasAccount')} </span>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              onSwitchToLogin()
            }}
            className="text-primary hover:underline font-medium"
          >
            {t('loginLink')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

