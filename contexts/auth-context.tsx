"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import type { User as SupabaseUser, Session } from "@supabase/supabase-js"
import { toast } from "@/hooks/use-toast"

interface User {
  email: string
  name: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  clearError: () => void
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
}

function mapSupabaseUser(sbUser: SupabaseUser | null): User | null {
  if (!sbUser?.email) return null
  const name =
    (sbUser.user_metadata?.full_name as string) ||
    (sbUser.user_metadata?.name as string) ||
    sbUser.email.split("@")[0]
  return { email: sbUser.email, name }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const setSession = (session: Session | null) => {
    setUser(mapSupabaseUser(session?.user ?? null))
  }

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted) setSession(session)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) setSession(session)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Redirect: if logged in and on login page → dashboard; if not logged in and on dashboard → login
  useEffect(() => {
    if (isLoading) return
    if (user && pathname === "/") {
      router.replace("/dashboard")
      return
    }
    if (!user && pathname?.startsWith("/dashboard")) {
      router.replace("/")
    }
  }, [user, isLoading, pathname, router])

  const clearError = () => setError(null)

  const signIn = async (email: string, password: string) => {
    setError(null)
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (err) {
      const message =
        err.message === "Invalid login credentials"
          ? "Invalid email or password."
          : err.message
      setError(message)
      toast({ title: "Sign in failed", description: message, variant: "destructive" })
      return
    }
    setSession(data.session)
    router.push("/dashboard")
  }

  const signInWithGoogle = async () => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    })
    if (err) {
      setError(err.message)
      toast({ title: "Google sign in failed", description: err.message, variant: "destructive" })
    }
  }

  const signUp = async (email: string, password: string, name: string) => {
    setError(null)
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    })
    if (err) {
      setError(err.message)
      toast({ title: "Sign up failed", description: err.message, variant: "destructive" })
      return
    }
    if (data.user && !data.session) {
      toast({
        title: "Check your email",
        description: "We sent you a confirmation link. Click it to confirm your account.",
      })
      return
    }
    setSession(data.session)
    router.push("/dashboard")
  }

  const signOut = async () => {
    setError(null)
    await supabase.auth.signOut()
    setUser(null)
    router.push("/")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        clearError,
        signIn,
        signInWithGoogle,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
