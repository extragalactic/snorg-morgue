import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { typography } from "@/lib/typography"
import { colors } from "@/lib/colors"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  /** Optional secondary value shown in brackets next to the main value (e.g. global average). */
  secondaryValue?: string | number
  subtitle?: string
  /** Optional line under the value (e.g. hours count), shown in smaller yellow */
  valueSubtext?: string
  icon: LucideIcon
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  className?: string
}

export function StatCard({
  title,
  value,
  secondaryValue,
  subtitle,
  valueSubtext,
  icon: Icon,
  trend,
  trendValue,
  className,
}: StatCardProps) {
  return (
    <Card className={cn(colors.cardBorder, "rounded-none bg-card", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className={cn(typography.bodyMuted, "font-mono uppercase tracking-wider")}>{title}</p>
            <p className={typography.statValue}>
              {value}
              {secondaryValue !== undefined && (
                <span className={cn("ml-2 text-sm", colors.average)}>
                  ({secondaryValue})
                </span>
              )}
            </p>
            {valueSubtext && (
              <p className="text-sm font-mono text-primary">{valueSubtext}</p>
            )}
            {subtitle && <p className={cn(typography.bodyMuted, "whitespace-pre-line")}>{subtitle}</p>}
            {trend && trendValue && (
              <p
                className={cn(
                  "text-xs",
                  trend === "up" && colors.success,
                  trend === "down" && colors.destructive,
                  trend === "neutral" && "text-muted-foreground"
                )}
              >
                {trend === "up" ? "+" : trend === "down" ? "-" : ""}{trendValue}
              </p>
            )}
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center", colors.inputBorder, "bg-primary/10")}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
