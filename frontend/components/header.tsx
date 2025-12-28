"use client"

import { useState, useEffect } from 'react'
import { Link } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { TrendingUp, LogOut, User, Plus } from "lucide-react"
import { LanguageSwitcher } from "./language-switcher"
import { LoginDialog } from "./login-dialog"
import { SignupDialog } from "./signup-dialog"
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface HeaderProps {
  onRecordOpportunity?: () => void
}

export function Header({ onRecordOpportunity }: HeaderProps = {}) {
  const t = useTranslations('header')
  const tOpp = useTranslations('opportunity.recorder')
  const { user, logout } = useAuth()
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showSignupDialog, setShowSignupDialog] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // 修复 Hydration 错误：等待客户端挂载
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // 获取邮箱的首字母作为头像
  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase()
  }
  
  return (
    <>
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <Link href="/" className="text-xl font-semibold">
                {t('title')}
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-8">
              <Link href="/market" className="text-sm font-medium hover:text-primary transition-colors">
                {t('market')}
              </Link>
              <Link href="/review" className="text-sm font-medium hover:text-primary transition-colors">
                {t('review')}
              </Link>
              <Link href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">
                {t('pricing')}
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              {mounted && user && onRecordOpportunity && (
                <Button 
                  size="sm" 
                  className="gap-2 bg-primary hover:bg-primary/90"
                  onClick={onRecordOpportunity}
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">{tOpp('recordNew')}</span>
                  <span className="sm:hidden"><Plus className="h-4 w-4" /></span>
                </Button>
              )}
              <LanguageSwitcher />
              {mounted && user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                          {getInitials(user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden sm:inline-block max-w-[150px] truncate">{user.email}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{t('myAccount')}</p>
                        <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled>
                      <User className="mr-2 h-4 w-4" />
                      <span>{t('profile')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>{t('logout')}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : mounted ? (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowLoginDialog(true)}
                  >
                    {t('login')}
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-primary hover:bg-primary/90"
                    onClick={() => setShowSignupDialog(true)}
                  >
                    {t('signup')}
                  </Button>
                </>
              ) : (
                // 服务端渲染和加载中显示占位符，避免 hydration 错误
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" disabled>
                    {t('login')}
                  </Button>
                  <Button size="sm" disabled>
                    {t('signup')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <LoginDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        onSwitchToSignup={() => setShowSignupDialog(true)}
      />
      <SignupDialog
        open={showSignupDialog}
        onOpenChange={setShowSignupDialog}
        onSwitchToLogin={() => setShowLoginDialog(true)}
      />
    </>
  )
}
