"use client"

import { ExternalLink, Globe, Youtube, Users, BookOpen, MessageSquare } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface LinkItem {
  title: string
  url: string
  description: string
}

interface LinkCategory {
  title: string
  icon: React.ElementType
  links: LinkItem[]
}

const linkCategories: LinkCategory[] = [
  {
    title: "Official Resources",
    icon: Globe,
    links: [
      {
        title: "Dungeon Crawl Stone Soup",
        url: "https://crawl.develz.org/",
        description: "Official DCSS website with downloads and documentation",
      },
      {
        title: "DCSS Online (CAO)",
        url: "https://crawl.akrasiac.org/",
        description: "Play DCSS online on the Akrasiac server",
      },
      {
        title: "DCSS Online (CWZ)",
        url: "https://crawl.xtahua.com/",
        description: "Play DCSS online on the Xtahua server",
      },
      {
        title: "DCSS Online (CBR2)",
        url: "https://crawl.dcss.io/",
        description: "Play DCSS online on the DCSS.io server",
      },
    ],
  },
  {
    title: "Community Wikis & Guides",
    icon: BookOpen,
    links: [
      {
        title: "DCSS Wiki",
        url: "https://crawl.chaosforge.org/",
        description: "Comprehensive wiki with game mechanics, species, and strategies",
      },
    ],
  },
  {
    title: "Community Forums",
    icon: MessageSquare,
    links: [
      {
        title: "Tavern (Official Forums)",
        url: "https://crawl.develz.org/tavern/",
        description: "Official DCSS discussion forums",
      },
      {
        title: "r/dcss Subreddit",
        url: "https://www.reddit.com/r/dcss/",
        description: "Active Reddit community for DCSS discussion",
      },
      {
        title: "Roguelikes Discord",
        url: "https://discord.gg/roguelikes",
        description: "Discord server with active DCSS channels",
      },
    ],
  },
  {
    title: "Active YouTube Channels",
    icon: Youtube,
    links: [
      {
        title: "Draconius Beats Roguelikes",
        url: "https://www.youtube.com/@DraconiusRogueLike",
        description: "Roguelike gameplay and DCSS content",
      },
      {
        title: "Dr. Incompetent",
        url: "https://www.youtube.com/@DrIncompetent",
        description: "Roguelike gameplay and commentary",
      },
      {
        title: "particleface",
        url: "https://www.youtube.com/@particleface",
        description: "DCSS gameplay and roguelike content",
      },
      {
        title: "Torinski",
        url: "https://www.youtube.com/@thetorinski",
        description: "DCSS and roguelike videos",
      },
      {
        title: "Jonny Community",
        url: "https://www.youtube.com/@JonnyCommunity",
        description: "DCSS and roguelike content",
      },
      {
        title: "ThePixelVillain",
        url: "https://www.youtube.com/@ThePixelVillain",
        description: "Roguelike gameplay and videos",
      },
    ],
  },
  {
    title: "Tools & Utilities",
    icon: Users,
    links: [
      {
        title: "DCSS Scoring",
        url: "https://crawl.akrasiac.org/scoring/overview.html",
        description: "Global leaderboards and player statistics",
      },
      {
        title: "Crawl RC Files",
        url: "https://github.com/crawl/crawl/tree/master/crawl-ref/docs",
        description: "Documentation for customizing your RC file",
      },
    ],
  },
]

export function Extras() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {linkCategories.map((category) => {
          const Icon = category.icon
          return (
            <Card key={category.title} className="border-2 border-primary/30 rounded-none">
              <CardHeader className="border-b-2 border-primary/20 pb-3">
                <CardTitle className="flex items-center gap-2 font-mono text-sm text-primary">
                  <Icon className="h-4 w-4" />
                  {category.title.toUpperCase()}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-3">
                  {category.links.map((link) => (
                    <li key={link.url}>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block border-2 border-transparent hover:border-primary/50 hover:bg-primary/5 p-3 transition-all"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-mono text-sm text-foreground group-hover:text-primary transition-colors">
                              {link.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {link.description}
                            </p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
