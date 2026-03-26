"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, ScrollText, Menu, X, LogOut, ExternalLink, Monitor, Terminal, Trophy, Shield, Flame } from "lucide-react"
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
import { isAdminEmail } from "@/lib/admin-auth"
import { slugifyUsername, TAB_TO_PAGE } from "@/lib/slug"

interface NavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
  /** When set, tab clicks only update client state + URL (replaceState); no Next.js navigation to avoid full refresh. */
  usernameSlug?: string
  /** When true, show Admin link as active (e.g. on admin page). */
  adminActive?: boolean
}

const navItems = [
  { id: "analysis", label: "Analytics", icon: BarChart3 },
  { id: "skills", label: "Skills", icon: Flame },
  { id: "achievements", label: "Achievements", icon: Trophy },
  { id: "morgues", label: "Morgues", icon: ScrollText },
  // { id: "extras", label: "Resources", icon: ExternalLink }, // Hidden - uncomment to restore
]

export function Navigation({ activeTab, onTabChange, usernameSlug, adminActive }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const { themeStyle, setThemeStyle } = useTheme()
  const showAdmin = isAdminEmail(user?.email)
  const isAdminPage = adminActive ?? pathname === "/dashboard/admin"
  const slugFromUser = user?.name ? slugifyUsername(user.name) : null
  const useNavLinks = !usernameSlug && slugFromUser && isAdminPage

  const renderNavItem = (item: (typeof navItems)[0], mobile = false) => {
    const Icon = item.icon
    const isActive = activeTab === item.id
    const buttonClass = cn(
      "rounded-none border-2 font-mono text-sm",
      isActive
        ? "border-primary bg-primary text-primary-foreground"
        : "border-transparent hover:border-primary/50 hover:bg-primary/10 hover:text-primary",
      mobile && "w-full justify-start mb-1"
    )
    const pagePath = TAB_TO_PAGE[item.id]
    const href = pagePath && slugFromUser ? `/${slugFromUser}/${pagePath}` : undefined

    if (useNavLinks && href) {
      return (
        <Link
          key={item.id}
          href={href}
          onClick={() => mobile && setMobileMenuOpen(false)}
        >
          <Button
            variant="ghost"
            size="default"
            className={cn(buttonClass, mobile && "w-full justify-start")}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Button>
        </Link>
      )
    }

    return (
      <Button
        key={item.id}
        variant={isActive ? "default" : "ghost"}
        size="default"
        className={cn(buttonClass, mobile && "w-full justify-start")}
        onClick={() => {
          onTabChange(item.id)
          if (mobile) setMobileMenuOpen(false)
        }}
      >
        <Icon className="h-4 w-4" />
        {item.label}
      </Button>
    )
  }

  return (
    <nav className="border-b-4 border-green-500 bg-card">
      {/* Large Site Title */}
      <div className="border-b-2 border-green-500/30 bg-gradient-to-b from-green-950/50 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-4">
          {themeStyle === "ascii" ? (
            <pre className="max-w-full text-left text-green-400/80 text-[13px] sm:text-[1rem] font-mono leading-none overflow-x-auto overflow-y-hidden">
{`                                                                          
 ___ _ __   ___  _ __ __ _       _ __ ___   ___  _ __ __ _ _   _  ___   ___  _ __ __ _ 
/ __| '_ \\ / _ \\| '__/ _\` |_____| '_ \` _ \\ / _ \\| '__/ _\` | | | |/ _ \\ / _ \\| '__/ _\` |
\\__ \\ | | | (_) | | | (_| |_____| | | | | | (_) | | | (_| | |_| |  __/| (_) | | | (_| |
|___/_| |_|\\___/|_|  \\__, |     |_| |_| |_|\\___/|_|  \\__, |\\__,_|\\___(_)___/|_|  \\__, |
                     |___/                          |___/                       |___/ `}
            </pre>
          ) : (
            <div className="flex items-center justify-start gap-4">
              <Image 
                src="/images/snorg.png" 
                alt="Snorg the Troll" 
                width={64} 
                height={64}
                className="h-16 w-16 object-contain drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
              />
              <h1 
                className="text-[3.1rem] sm:text-[3.5rem] md:text-[4rem] text-green-400 tracking-wider drop-shadow-[0_0_10px_rgba(34,197,94,0.6)]"
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
            {navItems.map((item) => renderNavItem(item))}
            {showAdmin && (
              <Link href="/dashboard/admin">
                <Button
                  variant={isAdminPage ? "default" : "ghost"}
                  size="default"
                  className={cn(
                    "rounded-none border-2 font-mono text-sm",
                    isAdminPage
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-transparent hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Button>
              </Link>
            )}
          </div>

          {/* User Info, Theme Selector & Sign Out */}
          <div className="hidden md:flex items-center gap-3">
            {user && (
              <span className="font-mono text-base text-muted-foreground">
                {user.name}
              </span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-none border-0 font-mono text-sm hover:text-primary"
                >
                  {themeStyle === "tiles" ? (
                    <Monitor className="h-4 w-4" />
                  ) : (
                    <Terminal className="h-4 w-4" />
                  )}
                  {themeStyle === "tiles" ? "Monitor" : "Terminal"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-none border-2 border-primary">
                <DropdownMenuItem 
                  onClick={() => setThemeStyle("tiles")}
                  className="gap-2 font-mono text-sm cursor-pointer hover:text-primary"
                >
                  <Monitor className="h-4 w-4" />
                  Monitor
                  {themeStyle === "tiles" && <span className="ml-auto text-primary">*</span>}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setThemeStyle("ascii")}
                  className="gap-2 font-mono text-sm cursor-pointer hover:text-primary"
                >
                  <Terminal className="h-4 w-4" />
                  Terminal
                  {themeStyle === "ascii" && <span className="ml-auto text-primary">*</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "nav-signout gap-2 rounded-none border-2 text-primary hover:bg-destructive/10 font-mono text-sm",
                themeStyle === "tiles" ? "border-primary/50" : "border-red-500/50"
              )}
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
            {navItems.map((item) => renderNavItem(item, true))}
            {showAdmin && (
              <Link href="/dashboard/admin" className="block mb-1" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant={isAdminPage ? "default" : "ghost"}
                  size="default"
                  className={cn(
                    "w-full justify-start rounded-none border-2 font-mono text-sm",
                    isAdminPage
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-transparent hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Button>
              </Link>
            )}
            {/* Mobile Theme Selector & Sign Out */}
            <div className="mt-2 pt-2 border-t border-primary/30">
              {user && (
                <p className="text-sm text-muted-foreground mb-2 px-2">
                  Signed in as {user.name}
                </p>
              )}
              <div className="flex gap-2 mb-2">
                <Button
                  variant={themeStyle === "tiles" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-2 rounded-none border-2 font-mono text-sm hover:text-primary"
                  onClick={() => setThemeStyle("tiles")}
                >
                  <Monitor className="h-4 w-4" />
                  Monitor
                </Button>
                <Button
                  variant={themeStyle === "ascii" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 gap-2 rounded-none border-2 font-mono text-sm hover:text-primary"
                  onClick={() => setThemeStyle("ascii")}
                >
                  <Terminal className="h-4 w-4" />
                  Terminal
                </Button>
              </div>
              <Button
                variant="ghost"
                className={cn(
                  "nav-signout w-full justify-start gap-2 rounded-none border-2 text-primary hover:bg-destructive/10 font-mono text-sm",
                  themeStyle === "tiles" ? "border-primary/50" : "border-red-500/50"
                )}
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
