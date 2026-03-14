"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'
import type { User as SupabaseUser, AuthError, Session } from '@supabase/supabase-js'

export interface User {
  id: string
  email: string
  user_metadata?: {
    username?: string
    avatar_url?: string
  }
}

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: (redirectPath?: string) => Promise<void>
  signup: (email: string, password: string) => Promise<{ needsEmailVerification: boolean }>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // 检查当前会话
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ? mapSupabaseUser(session.user) : null)
      } catch (error) {
        console.error('Failed to get session:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ? mapSupabaseUser(session.user) : null)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const mapSupabaseUser = (supabaseUser: SupabaseUser): User => {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      user_metadata: supabaseUser.user_metadata
    }
  }

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message || '登录失败')
    }

    if (data.user) {
      setUser(mapSupabaseUser(data.user))
    }
  }

  const loginWithGoogle = async (redirectPath?: string) => {
    const currentPath =
      redirectPath ||
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`)
    callbackUrl.searchParams.set('redirectTo', currentPath)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      throw new Error(error.message || 'Google 登录失败')
    }
  }

  const signup = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    })

    if (error) {
      const message = (error.message || '').toLowerCase()
      if (message.includes('already registered') || message.includes('already been registered') || message.includes('email exists')) {
        throw new Error('EMAIL_ALREADY_REGISTERED')
      }
      throw new Error(error.message || '注册失败')
    }

    // Supabase 在开启防邮箱枚举时，已注册邮箱可能返回 error=null，
    // 但 session 为空且 identities 为空数组。
    const identities = data.user?.identities
    if (!data.session && Array.isArray(identities) && identities.length === 0) {
      throw new Error('EMAIL_ALREADY_REGISTERED')
    }

    // Supabase 在开启邮箱验证时通常返回 user 但 session 为空，此时不应视为已登录
    if (data.session?.user) {
      setSession(data.session)
      setUser(mapSupabaseUser(data.session.user))
      return { needsEmailVerification: false }
    }

    setSession(null)
    setUser(null)
    return { needsEmailVerification: true }
  }

  const logout = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Logout error:', error)
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading, login, loginWithGoogle, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

