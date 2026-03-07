"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface Goal {
  name: string
  description: string
  current: number
  max: number
}

const goals: Goal[] = [
  { 
    name: "Great Player", 
    description: "Win with 27 different species",
    current: 12, 
    max: 27 
  },
  { 
    name: "Greater Player", 
    description: "Win with 27 different backgrounds",
    current: 18, 
    max: 27 
  },
  { 
    name: "Polytheist", 
    description: "Win while worshipping 27 different gods",
    current: 9, 
    max: 27 
  },
]

export function GoalProgress() {
  return (
    <Card className="border-2 border-primary/30 rounded-none">
      <CardHeader className="border-b-2 border-primary/20 pb-3">
        <CardTitle className="font-mono text-sm text-primary">
          GOAL PROGRESS
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid gap-6 md:grid-cols-3">
          {goals.map((goal) => {
            const percentage = (goal.current / goal.max) * 100
            return (
              <div key={goal.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-foreground">{goal.name}</span>
                  <span className="font-mono text-sm text-primary">
                    {goal.current}/{goal.max}
                  </span>
                </div>
                <Progress 
                  value={percentage} 
                  className="h-3 rounded-none bg-secondary border border-primary/30"
                />
                <p className="text-xs text-muted-foreground">{goal.description}</p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
