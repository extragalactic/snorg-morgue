"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"

const HYDRA_IMAGES = [
  "/images/hydra-1-head.png",
  "/images/hydra-2-head.png",
  "/images/hydra-3-head.png",
  "/images/hydra-4-head.png",
  "/images/hydra-5-head.png",
] as const

const FRAME_DURATION_MS = 500

/** Bounce sequence: 1→2→3→4→5→4→3→2→1→2… (indices 0–4) */
const BOUNCE_SEQUENCE = [0, 1, 2, 3, 4, 3, 2, 1] as const

interface HydraLoaderProps {
  /** When true, the animation runs. */
  active?: boolean
  /** Size in pixels. Default 32. */
  size?: number
  className?: string
}

/**
 * Animated loader that cycles through 5 hydra head images in a bouncing loop.
 * Each image is shown for 500ms. Sequence: 1→2→3→4→5→4→3→2→1→2…
 */
export function HydraLoader({ active = true, size = 32, className }: HydraLoaderProps) {
  const [seqIndex, setSeqIndex] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setSeqIndex((prev) => (prev + 1) % BOUNCE_SEQUENCE.length)
    }, FRAME_DURATION_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [active])

  if (!active) return null

  const imageIndex = BOUNCE_SEQUENCE[seqIndex]

  return (
    <Image
      src={HYDRA_IMAGES[imageIndex]}
      alt=""
      width={size}
      height={size}
      className={className}
      aria-hidden
    />
  )
}
