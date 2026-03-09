"use client"

import { useState } from "react"
import { Mail, Lock, User, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/contexts/theme-context"
import Image from "next/image"

export default function LoginPage() {
  const { signIn, signInWithGoogle, signUp, isLoading, error, clearError } = useAuth()
  const { themeStyle } = useTheme()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sign In form state
  const [signInEmail, setSignInEmail] = useState("")
  const [signInPassword, setSignInPassword] = useState("")

  // Sign Up form state
  const [signUpName, setSignUpName] = useState("")
  const [signUpEmail, setSignUpEmail] = useState("")
  const [signUpPassword, setSignUpPassword] = useState("")

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await signIn(signInEmail, signInPassword)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await signUp(signUpEmail, signUpPassword, signUpName)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Site Title Header */}
      <header className="border-b-4 border-green-500 bg-card">
        <div className="border-b-2 border-green-500/30 bg-gradient-to-b from-green-950/50 to-transparent">
          <div className="mx-auto max-w-7xl px-4 py-6">
            {themeStyle === "ascii" ? (
              <pre className="text-center text-green-400/80 text-[10px] sm:text-xs font-mono leading-none">
{`                                                                          
 ___ _ __   ___  _ __ __ _       _ __ ___   ___  _ __ __ _ _   _  ___   ___  _ __ __ _ 
/ __| '_ \\ / _ \\| '__/ _\` |_____| '_ \` _ \\ / _ \\| '__/ _\` | | | |/ _ \\ / _ \\| '__/ _\` |
\\__ \\ | | | (_) | | | (_| |_____| | | | | | (_) | | | (_| | |_| |  __/| (_) | | | (_| |
|___/_| |_|\\___/|_|  \\__, |     |_| |_| |_|\\___/|_|  \\__, |\\__,_|\\___(_)___/|_|  \\__, |
                     |___/                          |___/                       |___/ `}
              </pre>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <Image 
                  src="/images/snorg.png" 
                  alt="Snorg the Troll" 
                  width={80} 
                  height={80}
                  className="h-20 w-20 object-contain drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                />
                <h1 
                  className="text-4xl sm:text-5xl md:text-7xl text-green-400 tracking-wider drop-shadow-[0_0_10px_rgba(34,197,94,0.6)]"
                  style={{ fontFamily: 'var(--font-troll)' }}
                >
                  snorg-morgue.org
                </h1>
              </div>
            )}
            <p className="text-center text-muted-foreground mt-2">
              Dungeon Crawl Stone Soup Analytics
            </p>
          </div>
        </div>
      </header>

      {/* Login Form */}
      <main className="flex-1 flex items-center justify-center px-4 py-12 -mt-20">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[200px]">
            <p className="text-muted-foreground font-mono">Loading…</p>
          </div>
        ) : (
        <div className="w-full max-w-md">
          {/* Intro Image */}
          <Image
            src="/images/snorg-intro.png"
            alt="A troll in the dungeon"
            width={800}
            height={450}
            className="w-full h-auto border-2 border-green-500/30 border-b-0"
            priority
          />
          <Card className="w-full border-2 border-green-500/30 bg-card/80 backdrop-blur rounded-none">
          <CardHeader className="text-center border-b border-green-500/20 pb-6">
            <CardTitle className="text-2xl text-green-400" style={{ fontFamily: 'var(--font-troll)' }}>
              {"Welcome to Snorg's Morgue"}
            </CardTitle>
            <CardDescription>
              Sign up to track your DCSS progress
            </CardDescription>
            <p className="mt-1 text-xs text-green-400 font-mono">
              Updated for v0.34
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            {error && (
              <Alert variant="destructive" className="mb-4 rounded-none border-2 border-red-500/50">
                <AlertDescription className="flex items-center justify-between gap-2">
                  {error}
                  <button type="button" onClick={clearError} className="text-xs underline">Dismiss</button>
                </AlertDescription>
              </Alert>
            )}
            <Tabs defaultValue="signin" className="w-full" onValueChange={clearError}>
              <TabsList className="grid w-full grid-cols-2 rounded-none bg-secondary/50 p-1">
                <TabsTrigger 
                  value="signin" 
                  className="rounded-none data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400"
                >
                  Sign In
                </TabsTrigger>
                <TabsTrigger 
                  value="signup"
                  className="rounded-none data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400"
                >
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* Sign In Tab */}
              <TabsContent value="signin" className="mt-6">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email" className="text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="adventurer@dcss.com"
                        value={signInEmail}
                        onChange={(e) => setSignInEmail(e.target.value)}
                        className="pl-10 rounded-none border-2 border-green-500/30 bg-background focus:border-green-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password" className="text-sm">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={signInPassword}
                        onChange={(e) => setSignInPassword(e.target.value)}
                        className="pl-10 pr-10 rounded-none border-2 border-green-500/30 bg-background focus:border-green-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || isLoading}
                    className="w-full rounded-none border-2 border-green-500 bg-green-500/20 text-green-400 hover:bg-green-500/30 font-mono"
                  >
                    {isSubmitting ? "…" : "ENTER"}
                  </Button>
                </form>
              </TabsContent>

              {/* Sign Up Tab */}
              <TabsContent value="signup" className="mt-6">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name" className="text-sm">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Your username"
                        value={signUpName}
                        onChange={(e) => setSignUpName(e.target.value)}
                        className="pl-10 rounded-none border-2 border-green-500/30 bg-background focus:border-green-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email" className="text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="adventurer@dcss.com"
                        value={signUpEmail}
                        onChange={(e) => setSignUpEmail(e.target.value)}
                        className="pl-10 rounded-none border-2 border-green-500/30 bg-background focus:border-green-500"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password" className="text-sm">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Choose a password"
                        value={signUpPassword}
                        onChange={(e) => setSignUpPassword(e.target.value)}
                        className="pl-10 pr-10 rounded-none border-2 border-green-500/30 bg-background focus:border-green-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting || isLoading}
                    className="w-full rounded-none border-2 border-green-500 bg-green-500/20 text-green-400 hover:bg-green-500/30 font-mono"
                  >
                    {isSubmitting ? "…" : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-green-500/20"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">or continue with</span>
              </div>
            </div>

            {/* Google Sign In */}
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={signInWithGoogle}
              className="w-full rounded-none border-2 border-muted-foreground/30 hover:border-green-500/50 hover:bg-green-500/10"
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </Button>
          </CardContent>
        </Card>
        </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-green-500/20 bg-card/50 py-4">
        <p className="text-center text-sm text-muted-foreground font-mono">
          Snorg.
        </p>
      </footer>
    </div>
  )
}
