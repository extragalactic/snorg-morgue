"use client"

import { useState } from "react"
import { BarChart3, ScrollText, Menu, X, LogOut, ExternalLink, Monitor, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/contexts/theme-context"

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const navItems = [
  { id: "analysis", label: "Analysis", icon: BarChart3 },
  { id: "morgues", label: "Morgues", icon: ScrollText },
  { id: "extras", label: "Extras", icon: ExternalLink },
]

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, signOut } = useAuth()
  const { themeStyle, setThemeStyle } = useTheme()

  return (
    <nav className="border-b-4 border-green-500 bg-card">
      {/* Large Site Title */}
      <div className="border-b-2 border-green-500/30 bg-gradient-to-b from-green-950/50 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-4">
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
                width={64} 
                height={64}
                className="h-16 w-16 object-contain drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
              />
              <h1 
                className="text-4xl sm:text-5xl md:text-6xl text-green-400 tracking-wider drop-shadow-[0_0_10px_rgba(34,197,94,0.6)]"
                style={{ fontFamily: 'var(--font-troll)' }}
              >
                snorg-morgue.org
              </h1>
            </div>
          )}
        </div>
      </div>
      
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between">

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className={cn(
                    "gap-2 rounded-none border-2 font-mono text-xs",
                    activeTab === item.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-transparent hover:border-primary/50 hover:bg-primary/10"
                  )}
                  onClick={() => onTabChange(item.id)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              )
            })}
          </div>

          {/* User Info, Theme Selector & Sign Out */}
          <div className="hidden md:flex items-center gap-3">
            {user && (
              <span className="text-xs text-muted-foreground">
                {user.name}
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-none border-2 border-primary/50 font-mono text-xs hover:text-yellow-400"
                >
                  {themeStyle === "tiles" ? (
                    <Monitor className="h-4 w-4" />
                  ) : (
                    <Terminal className="h-4 w-4" />
                  )}
                  {themeStyle === "tiles" ? "Tiles" : "ASCII"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-none border-2 border-primary/50">
                <DropdownMenuItem 
                  onClick={() => setThemeStyle("tiles")}
                  className="gap-2 font-mono text-xs cursor-pointer hover:text-yellow-400"
                >
                  <Monitor className="h-4 w-4" />
                  Tiles
                  {themeStyle === "tiles" && <span className="ml-auto text-primary">*</span>}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setThemeStyle("ascii")}
                  className="gap-2 font-mono text-xs cursor-pointer hover:text-yellow-400"
                >
                  <Terminal className="h-4 w-4" />
                  ASCII
                  {themeStyle === "ascii" && <span className="ml-auto text-primary">*</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 rounded-none border-2 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 font-mono text-xs"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden rounded-none border-2 border-primary"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t-2 border-primary/30 py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-2 rounded-none border-2 font-mono text-xs mb-1",
                    activeTab === item.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-transparent hover:border-primary/50"
                  )}
                  onClick={() => {
                    onTabChange(item.id)
                    setMobileMenuOpen(false)
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              )
            })}
            {/* Mobile Theme Selector & Sign Out */}
            <div className="mt-2 pt-2 border-t border-primary/30">
              {user && (
                <p className="text-xs text-muted-foreground mb-2 px-2">
                  Signed in as {user.name}
                </p>
              )}
              <div className="flex gap-2 mb-2">
                <Button
                  variant={themeStyle === "tiles" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-2 rounded-none border-2 font-mono text-xs hover:text-yellow-400"
                  onClick={() => setThemeStyle("tiles")}
                >
                  <Monitor className="h-4 w-4" />
                  Tiles
                </Button>
                <Button
                  variant={themeStyle === "ascii" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-2 rounded-none border-2 font-mono text-xs hover:text-yellow-400"
                  onClick={() => setThemeStyle("ascii")}
                >
                  <Terminal className="h-4 w-4" />
                  ASCII
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 rounded-none border-2 border-red-500/50 text-red-400 hover:bg-red-500/10 font-mono text-xs"
                onClick={signOut}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
