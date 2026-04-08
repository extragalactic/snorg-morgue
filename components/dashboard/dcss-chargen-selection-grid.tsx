"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FilterToggleButton } from "@/components/ui/filter-toggle-button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ALL_BACKGROUND_NAMES,
  ALL_SPECIES_NAMES,
  DRACONIAN_COLOUR_NAMES,
  GOD_NAMES_ALPHABETICAL,
  godsIntoChargenColumns,
} from "@/lib/dcss-constants"
import type { GameRecord } from "@/lib/morgue-api"
import { cn } from "@/lib/utils"

const RLTILES_BASE =
  "https://raw.githubusercontent.com/crawl/crawl/master/crawl-ref/source/rltiles"

/** Header row / in-game light blue */
const DCSS_HEADER = "#5555ff"
const DCSS_WIN = "#ffffff"
const DCSS_ATTEMPT = "#888888"
const DCSS_NONE = "#444444"
const DCSS_PANEL_BG = "#000000"

type Mode = "species" | "background" | "gods"
type Tint = "win" | "attempt" | "none"

function normalizeChargenSpecies(raw: string): string {
  const s = raw.trim()
  if (!s) return s
  if (DRACONIAN_COLOUR_NAMES.includes(s)) return "Draconian"
  if (s.endsWith(" Draconian")) return "Draconian"
  return s
}

function speciesHotkey(globalIndex: number): string {
  if (globalIndex === ALL_SPECIES_NAMES.length - 1) return "A"
  return String.fromCharCode(97 + globalIndex)
}

function backgroundHotkey(index: number): string {
  return String.fromCharCode(97 + index)
}

function godHotkey(index: number): string {
  return String.fromCharCode(97 + index)
}

/** Canonical species → base tile (matches DCSS chargen feel; uses trunk rltiles). */
const SPECIES_TILE_PATH: Record<string, string> = {
  Gnoll: "player/base/gnoll_m.png",
  Minotaur: "player/base/minotaur_m.png",
  Merfolk: "player/base/merfolk_m.png",
  Gargoyle: "player/base/gargoyle_m.png",
  "Mountain Dwarf": "player/base/dwarf_m.png",
  Draconian: "player/base/draconian.png",
  Troll: "player/base/troll_m.png",
  "Deep Elf": "player/base/deep_elf_m.png",
  Armataur: "player/base/lorc_m0.png",
  Human: "player/base/human_m.png",
  Kobold: "player/base/kobold_m.png",
  Revenant: "player/base/revenant.png",
  Demonspawn: "player/base/demonspawn_red_m.png",
  Djinni: "player/base/djinni_red_m.png",
  Spriggan: "player/base/spriggan_m.png",
  Tengu: "player/base/tengu_winged_m.png",
  Oni: "player/base/oni_red_m.png",
  Barachi: "player/base/frog2_m.png",
  Coglin: "player/base/coglin.png",
  "Vine Stalker": "player/base/vine_stalker_green_m.png",
  Poltergeist: "player/base/poltergeist.png",
  Demigod: "player/base/demigod_m.png",
  Formicid: "player/base/formicid.png",
  Naga: "player/base/naga_green_m.png",
  Octopode: "player/base/octopode1.png",
  Felid: "player/felids/cat1.png",
  Mummy: "player/base/mummy_m.png",
}

/** Background → gui/backgrounds/*.png path under rltiles, or special path for missing job tile. */
const BACKGROUND_TILE_PATH: Record<string, string> = {
  Fighter: "gui/backgrounds/Fi.png",
  Gladiator: "gui/backgrounds/Gl.png",
  Monk: "gui/backgrounds/Mo.png",
  Hunter: "gui/backgrounds/Hu.png",
  Brigand: "gui/backgrounds/Br.png",
  Berserker: "gui/backgrounds/Be.png",
  "Cinder Acolyte": "gui/backgrounds/CA.png",
  "Chaos Knight": "gui/backgrounds/CK.png",
  Artificer: "gui/backgrounds/Ar.png",
  Shapeshifter: "gui/backgrounds/HS.png",
  Wanderer: "gui/backgrounds/Wn.png",
  Delver: "gui/backgrounds/De.png",
  Warper: "gui/backgrounds/Wr.png",
  // Trunk still lacks gui/backgrounds/Hs.png
  Hexslinger: "gui/skills/hexes.png",
  Enchanter: "gui/backgrounds/En.png",
  Reaver: "gui/backgrounds/Re.png",
  "Hedge Wizard": "gui/backgrounds/HW.png",
  Conjurer: "gui/backgrounds/Cj.png",
  Summoner: "gui/backgrounds/Su.png",
  Necromancer: "gui/backgrounds/Ne.png",
  Forgewright: "gui/backgrounds/Fw.png",
  "Fire Elementalist": "gui/backgrounds/FE.png",
  "Ice Elementalist": "gui/backgrounds/IE.png",
  "Air Elementalist": "gui/backgrounds/AE.png",
  "Earth Elementalist": "gui/backgrounds/EE.png",
  Alchemist: "gui/backgrounds/Al.png",
}

/** One rltiles path per god (invocations / spells) for chargen-style rows. */
const GOD_TILE_PATH: Record<string, string> = {
  Ashenzari: "gui/invocations/ashenzari_curse.png",
  Beogh: "gui/invocations/beogh_recall.png",
  Cheibriados: "gui/invocations/cheibriados_bend_time.png",
  Dithmenos: "gui/invocations/dithmenos_shadowslip.png",
  Elyvilon: "gui/invocations/elyvilon_divine_vigour.png",
  Fedhas: "gui/invocations/fedhas_wall_of_briars.png",
  Gozag: "gui/invocations/gozag_potion_petition.png",
  Hepliaklqana: "gui/invocations/hep_idealise.png",
  Ignis: "gui/invocations/ignis_fiery_armour.png",
  Jiyva: "gui/invocations/jiyva_slimify.png",
  Kikubaaqudgha: "gui/invocations/kiku_unearth_wretches.png",
  Lugonu: "gui/invocations/lugonu_banish.png",
  Makhleb: "gui/invocations/makhleb_lesser_servant.png",
  Nemelex: "gui/invocations/nemelex_draw_destruction.png",
  Okawaru: "gui/invocations/okawaru_finesse.png",
  Qazlal: "gui/invocations/qazlal_upheaval.png",
  Ru: "gui/invocations/ru_draw_out_power.png",
  "Sif Muna": "gui/invocations/sif_muna_channel.png",
  Trog: "gui/invocations/trog_berserk.png",
  Uskayaw: "gui/invocations/uskayaw_stomp.png",
  Vehumet: "gui/spells/fire/fire_storm.png",
  "Wu Jian": "gui/invocations/wu_jian_wall_jump.png",
  Xom: "gui/spells/monster/call_of_chaos.png",
  Yredelemnul: "gui/invocations/yred_light_the_torch.png",
  Zin: "gui/invocations/zin_imprison.png",
  "The Shining One": "gui/invocations/tso_cleansing_flame.png",
}

function tileUrl(path: string): string {
  return `${RLTILES_BASE}/${path}`
}

const SPECIES_COLUMNS: { title: string; species: readonly string[] }[] = [
  { title: "Simple", species: ALL_SPECIES_NAMES.slice(0, 9) },
  { title: "Intermediate", species: ALL_SPECIES_NAMES.slice(9, 18) },
  { title: "Advanced", species: ALL_SPECIES_NAMES.slice(18) },
]

type BgSection = { title: string; backgrounds: readonly string[] }

const BACKGROUND_COLUMN_SECTIONS: [BgSection[], BgSection[], BgSection[]] = [
  [
    { title: "Warrior", backgrounds: ALL_BACKGROUND_NAMES.slice(0, 5) },
    { title: "Zealot", backgrounds: ALL_BACKGROUND_NAMES.slice(5, 8) },
  ],
  [
    { title: "Adventurer", backgrounds: ALL_BACKGROUND_NAMES.slice(8, 12) },
    { title: "Warrior-mage", backgrounds: ALL_BACKGROUND_NAMES.slice(12, 16) },
  ],
  [{ title: "Mage", backgrounds: ALL_BACKGROUND_NAMES.slice(16) }],
]

const GOD_CHARGEN_COLUMNS = godsIntoChargenColumns(GOD_NAMES_ALPHABETICAL, 3)

function tintFor(wins: number, attempts: number): Tint {
  if (wins > 0) return "win"
  if (attempts > 0) return "attempt"
  return "none"
}

function tintColor(t: Tint): string {
  switch (t) {
    case "win":
      return DCSS_WIN
    case "attempt":
      return DCSS_ATTEMPT
    default:
      return DCSS_NONE
  }
}

function iconDim(t: Tint): number {
  switch (t) {
    case "win":
      return 1
    case "attempt":
      return 0.85
    default:
      return 0.45
  }
}

export function DcssChargenSelectionGrid({ morgues = [] }: { morgues?: GameRecord[] }) {
  const [mode, setMode] = useState<Mode>("species")

  const speciesCounts = useMemo(() => {
    const wins = new Map<string, number>()
    const attempts = new Map<string, number>()
    for (const m of morgues) {
      const sp = normalizeChargenSpecies(m.species ?? "")
      if (!sp) continue
      attempts.set(sp, (attempts.get(sp) ?? 0) + 1)
      if (m.result === "win") wins.set(sp, (wins.get(sp) ?? 0) + 1)
    }
    return { wins, attempts }
  }, [morgues])

  const backgroundCounts = useMemo(() => {
    const wins = new Map<string, number>()
    const attempts = new Map<string, number>()
    for (const m of morgues) {
      const bg = (m.background ?? "").trim()
      if (!bg) continue
      attempts.set(bg, (attempts.get(bg) ?? 0) + 1)
      if (m.result === "win") wins.set(bg, (wins.get(bg) ?? 0) + 1)
    }
    return { wins, attempts }
  }, [morgues])

  const godCounts = useMemo(() => {
    const wins = new Map<string, number>()
    const attempts = new Map<string, number>()
    for (const m of morgues) {
      const god = (m.god ?? "").trim()
      if (!god) continue
      attempts.set(god, (attempts.get(god) ?? 0) + 1)
      if (m.result === "win") wins.set(god, (wins.get(god) ?? 0) + 1)
    }
    return { wins, attempts }
  }, [morgues])

  return (
    <section className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <Card className="rounded-none border-2 border-primary/30">
          <CardHeader className="flex flex-col gap-3 border-b-2 border-primary/20 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg sm:text-xl">DCSS CHARGEN (SPECIES / BACKGROUND / GODS)</CardTitle>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="font-mono text-sm text-primary">VIEW:</span>
              <div className="flex gap-2">
                <FilterToggleButton
                  selected={mode === "species"}
                  onClick={() => setMode("species")}
                >
                  Species
                </FilterToggleButton>
                <FilterToggleButton
                  selected={mode === "background"}
                  onClick={() => setMode("background")}
                >
                  Background
                </FilterToggleButton>
                <FilterToggleButton selected={mode === "gods"} onClick={() => setMode("gods")}>
                  Gods
                </FilterToggleButton>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div
              className="box-border rounded-none border border-neutral-800 p-4 font-mono text-base leading-relaxed md:text-lg"
              style={{ backgroundColor: DCSS_PANEL_BG }}
            >
              <div className="grid">
                <div
                  className={cn(
                    "col-start-1 row-start-1 self-start grid min-w-0 gap-8 md:grid-cols-3 lg:gap-12",
                    mode !== "species" && "invisible pointer-events-none"
                  )}
                  aria-hidden={mode !== "species"}
                >
                  {SPECIES_COLUMNS.map((col) => (
                    <div key={col.title} className="min-w-0 space-y-3">
                      <div
                        className="text-lg font-normal tracking-wide md:text-xl"
                        style={{ color: DCSS_HEADER }}
                      >
                        {col.title}
                      </div>
                      <div className="space-y-1.5">
                        {col.species.map((sp) => {
                          const globalIndex = ALL_SPECIES_NAMES.indexOf(sp)
                          const key = speciesHotkey(globalIndex)
                          const w = speciesCounts.wins.get(sp) ?? 0
                          const a = speciesCounts.attempts.get(sp) ?? 0
                          const tint = tintFor(w, a)
                          const path = SPECIES_TILE_PATH[sp]
                          const opacity = iconDim(tint)

                          const row = (
                            <div className="flex items-center gap-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={path ? tileUrl(path) : undefined}
                                alt=""
                                width={36}
                                height={36}
                                className="h-9 w-9 shrink-0 [image-rendering:pixelated]"
                                style={{ opacity }}
                                loading="lazy"
                              />
                              <span
                                className="w-[1.1ch] shrink-0 text-right"
                                style={{ color: tintColor(tint) }}
                              >
                                {key}
                              </span>
                              <span style={{ color: tintColor(tint) }}> - </span>
                              <span className="min-w-0 break-words" style={{ color: tintColor(tint) }}>
                                {sp}
                              </span>
                            </div>
                          )

                          return (
                            <Tooltip key={sp}>
                              <TooltipTrigger asChild>
                                <div className="w-fit max-w-full cursor-default">{row}</div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                className="rounded-none border border-primary/40 bg-black/95 py-2 pr-3 pl-[calc(0.75rem+5px)] font-mono text-sm text-neutral-100"
                              >
                                Wins: {w} · Attempts: {a}
                              </TooltipContent>
                            </Tooltip>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className={cn(
                    "col-start-1 row-start-1 self-start grid min-w-0 gap-8 md:grid-cols-3 lg:gap-12",
                    mode !== "background" && "invisible pointer-events-none"
                  )}
                  aria-hidden={mode !== "background"}
                >
                  {BACKGROUND_COLUMN_SECTIONS.map((sections, colIdx) => (
                    <div key={colIdx} className="min-w-0 space-y-6">
                      {sections.map((sec) => (
                        <div key={sec.title} className="space-y-3">
                          <div
                            className="text-lg font-normal tracking-wide md:text-xl"
                            style={{ color: DCSS_HEADER }}
                          >
                            {sec.title}
                          </div>
                          <div className="space-y-1.5">
                            {sec.backgrounds.map((bg) => {
                              const idx = ALL_BACKGROUND_NAMES.indexOf(bg)
                              const hk = idx >= 0 ? backgroundHotkey(idx) : "?"
                              const w = backgroundCounts.wins.get(bg) ?? 0
                              const a = backgroundCounts.attempts.get(bg) ?? 0
                              const tint = tintFor(w, a)
                              const path = BACKGROUND_TILE_PATH[bg]
                              const opacity = iconDim(tint)

                              const row = (
                                <div className="flex items-center gap-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={path ? tileUrl(path) : undefined}
                                    alt=""
                                    width={36}
                                    height={36}
                                    className="h-9 w-9 shrink-0 [image-rendering:pixelated]"
                                    style={{ opacity }}
                                    loading="lazy"
                                  />
                                  <span
                                    className="w-[1.1ch] shrink-0 text-right"
                                    style={{ color: tintColor(tint) }}
                                  >
                                    {hk}
                                  </span>
                                  <span style={{ color: tintColor(tint) }}> - </span>
                                  <span
                                    className="min-w-0 break-words"
                                    style={{ color: tintColor(tint) }}
                                  >
                                    {bg}
                                  </span>
                                </div>
                              )

                              return (
                                <Tooltip key={bg}>
                                  <TooltipTrigger asChild>
                                    <div className="w-fit max-w-full cursor-default">{row}</div>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="right"
                                    className="rounded-none border border-primary/40 bg-black/95 py-2 pr-3 pl-[calc(0.75rem+5px)] font-mono text-sm text-neutral-100"
                                  >
                                    Wins: {w} · Attempts: {a}
                                  </TooltipContent>
                                </Tooltip>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div
                  className={cn(
                    "col-start-1 row-start-1 grid min-w-0 items-start gap-8 md:grid-cols-3 lg:gap-12",
                    mode !== "gods" && "invisible pointer-events-none"
                  )}
                  aria-hidden={mode !== "gods"}
                >
                  {GOD_CHARGEN_COLUMNS.map((godsInCol, colIdx) => (
                    <div key={colIdx} className="min-w-0 space-y-3">
                      <div
                        className="text-lg font-normal tracking-wide md:text-xl"
                        style={{ color: DCSS_HEADER, visibility: "hidden" }}
                        aria-hidden
                      >
                        {"\u00a0"}
                      </div>
                      <div className="space-y-1.5">
                        {godsInCol.map((god) => {
                          const globalIndex = GOD_NAMES_ALPHABETICAL.indexOf(god)
                          const hk = globalIndex >= 0 ? godHotkey(globalIndex) : "?"
                          const w = godCounts.wins.get(god) ?? 0
                          const a = godCounts.attempts.get(god) ?? 0
                          const tint = tintFor(w, a)
                          const path = GOD_TILE_PATH[god]
                          const opacity = iconDim(tint)

                          const row = (
                            <div className="flex items-center gap-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={path ? tileUrl(path) : undefined}
                                alt=""
                                width={36}
                                height={36}
                                className="h-9 w-9 shrink-0 [image-rendering:pixelated]"
                                style={{ opacity }}
                                loading="lazy"
                              />
                              <span
                                className="w-[1.1ch] shrink-0 text-right"
                                style={{ color: tintColor(tint) }}
                              >
                                {hk}
                              </span>
                              <span style={{ color: tintColor(tint) }}> - </span>
                              <span className="min-w-0 break-words" style={{ color: tintColor(tint) }}>
                                {god}
                              </span>
                            </div>
                          )

                          return (
                            <Tooltip key={god}>
                              <TooltipTrigger asChild>
                                <div className="w-fit max-w-full cursor-default">{row}</div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                className="rounded-none border border-primary/40 bg-black/95 py-2 pr-3 pl-[calc(0.75rem+5px)] font-mono text-sm text-neutral-100"
                              >
                                Wins: {w} · Attempts: {a}
                              </TooltipContent>
                            </Tooltip>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div
                className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-neutral-700 pt-4 text-sm text-neutral-300 md:text-base"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-7 shrink-0 border border-neutral-600"
                    style={{ backgroundColor: DCSS_NONE }}
                    aria-hidden
                  />
                  <span>Not tried yet</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-7 shrink-0 border border-neutral-600"
                    style={{ backgroundColor: DCSS_ATTEMPT }}
                    aria-hidden
                  />
                  <span>Attempted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-7 shrink-0 border border-neutral-600"
                    style={{ backgroundColor: DCSS_WIN }}
                    aria-hidden
                  />
                  <span>Won</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
