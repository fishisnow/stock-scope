"use client"

import { useState, useEffect } from 'react'
import { Link } from "@/i18n/routing"
import { usePathname } from '@/i18n/routing'
import { useSearchParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { LogOut, User, Plus } from "lucide-react"
import { LanguageSwitcher } from "./language-switcher"
import { Logo } from "./logo"
import { LoginDialog } from "./login-dialog"
import { SignupDialog } from "./signup-dialog"
import { GoogleLoginPrompt } from "./google-login-prompt"
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

function GitHubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.05-3.34.73-4.04-1.61-4.04-1.61-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23A11.5 11.5 0 0 1 12 5.8c1.02 0 2.05.14 3 .4 2.3-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.6-2.8 5.62-5.48 5.92.43.37.82 1.1.82 2.22 0 1.6-.01 2.88-.01 3.27 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  )
}

export function Header({ onRecordOpportunity }: HeaderProps = {}) {
  const FIRST_VISIT_GOOGLE_PROMPT_KEY = 'stockscope_first_visit_google_prompt_v1'
  const t = useTranslations('header')
  const tOpp = useTranslations('opportunity.recorder')
  const { user, logout } = useAuth()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showSignupDialog, setShowSignupDialog] = useState(false)
  const [showGooglePrompt, setShowGooglePrompt] = useState(false)
  const [mounted, setMounted] = useState(false)
  const navItems = [
    { href: "/", label: t('home') },
    { href: "/opportunities", label: t('opportunity') },
    { href: "/briefing", label: t('briefing') },
    { href: "/market", label: t('market') },
    { href: "/review", label: t('review') },
  ]
  
  // 修复 Hydration 错误：等待客户端挂载
  useEffect(() => {
    setMounted(true)
  }, [])

  // 监听 URL 参数，如果存在 login=true，打开登录对话框
  useEffect(() => {
    if (mounted && searchParams.get('login') === 'true') {
      setShowLoginDialog(true)
      // 清除 URL 参数，避免刷新时重复打开
      const url = new URL(window.location.href)
      url.searchParams.delete('login')
      window.history.replaceState({}, '', url.toString())
    }
  }, [mounted, searchParams])

  // 首次访问时自动弹出登录框，引导用户使用 Google 登录
  useEffect(() => {
    if (!mounted || user || pathname.startsWith('/auth/callback')) {
      return
    }

    const hasPrompted = window.localStorage.getItem(FIRST_VISIT_GOOGLE_PROMPT_KEY)
    if (hasPrompted) {
      return
    }

    setShowGooglePrompt(true)
    window.localStorage.setItem(FIRST_VISIT_GOOGLE_PROMPT_KEY, '1')
  }, [FIRST_VISIT_GOOGLE_PROMPT_KEY, mounted, pathname, user])

  // 监听自定义事件，打开登录对话框
  useEffect(() => {
    const handleOpenLoginDialog = () => {
      setShowLoginDialog(true)
    }
    
    window.addEventListener('openLoginDialog', handleOpenLoginDialog)
    return () => {
      window.removeEventListener('openLoginDialog', handleOpenLoginDialog)
    }
  }, [])
  
  // 获取邮箱的首字母作为头像
  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase()
  }
  
  return (
    <>
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid h-16 grid-cols-[auto_1fr] md:grid-cols-[1fr_auto_1fr] items-center">
            <div className="flex items-center gap-1.5 sm:gap-2 justify-self-start min-w-0">
              <Logo
                className="h-5 w-5 sm:h-6 sm:w-6 text-primary shrink-0"
                aria-hidden="true"
                focusable="false"
              />
              <Link href="/" className="text-base sm:text-xl font-semibold whitespace-nowrap leading-none">
                {t('title')}
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-8 justify-self-center">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="text-sm font-medium hover:text-primary transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-2 justify-self-end">
              <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label="GitHub repository">
                <a
                  href="https://github.com/fishisnow/stock-scope"
                  target="_blank"
                  rel="noreferrer"
                >
                  <GitHubIcon className="h-4 w-4" />
                </a>
              </Button>
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
                    className="px-2 sm:px-3"
                    onClick={() => setShowLoginDialog(true)}
                  >
                    {t('login')}
                  </Button>
                  <Button 
                    size="sm" 
                    className="bg-primary hover:bg-primary/90 px-2 sm:px-3"
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

          <nav className="md:hidden pb-3 overflow-x-auto">
            <div className="flex min-w-max items-center gap-2">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)
                return (
                  <Link
                    key={`mobile-${item.href}`}
                    href={item.href}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </nav>
        </div>
      </header>

      <LoginDialog
        open={showLoginDialog}
        onOpenChange={setShowLoginDialog}
        onSwitchToSignup={() => setShowSignupDialog(true)}
      />
      <GoogleLoginPrompt
        open={showGooglePrompt}
        onClose={() => setShowGooglePrompt(false)}
      />
      <SignupDialog
        open={showSignupDialog}
        onOpenChange={setShowSignupDialog}
        onSwitchToLogin={() => setShowLoginDialog(true)}
      />
    </>
  )
}
