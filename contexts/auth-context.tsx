"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import { useRouter } from "next/navigation"

interface User {
  email: string
  name: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  signIn: (email: string, password: string) => void
  signInWithGoogle: () => void
  signUp: (email: string, password: string, name: string) => void
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()

  const signIn = (email: string, _password: string) => {
    // Simulate login - accept any credentials
    setUser({
      email,
      name: email.split("@")[0],
    })
    router.push("/dashboard")
  }

  const signInWithGoogle = () => {
    // Simulate Google login
    setUser({
      email: "adventurer@gmail.com",
      name: "Dungeon Adventurer",
    })
    router.push("/dashboard")
  }

  const signUp = (email: string, _password: string, name: string) => {
    // Simulate sign up
    setUser({
      email,
      name,
    })
    router.push("/dashboard")
  }

  const signOut = () => {
    setUser(null)
    router.push("/")
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
