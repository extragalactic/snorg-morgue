"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

/** Set to false to allow mobile; gate logic remains in place but is bypassed. */
const MOBILE_GATE_ENABLED = false

interface MobileGateProps {
  children: React.ReactNode
}

export function MobileGate({ children }: MobileGateProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const check = () => {
      // Simple viewport-width heuristic for mobile
      setIsMobile(window.innerWidth < 768)
      setChecked(true)
    }

    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  if (!checked) {
    // Avoid flash on initial load
    return null
  }

  if (!MOBILE_GATE_ENABLED || !isMobile) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="flex flex-col items-center gap-4 max-w-md">
        <Image
          src="/images/snorg.png"
          alt="Snorg the Troll"
          width={96}
          height={96}
          className="h-24 w-24 object-contain drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]"
        />
        <p className="font-mono text-lg text-primary">
          This fantastic Snorg experience is meant to be viewed on a larger monitor.
        </p>
        <p className="font-mono text-sm text-muted-foreground">
          Please switch to your laptop or desktop to continue.
        </p>
      </div>
    </div>
  )
}

