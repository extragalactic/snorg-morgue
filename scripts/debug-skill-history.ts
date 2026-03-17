import fs from "fs"
import path from "path"
import { parseSkillHistory, computeSkillSnapshotsFromHistory } from "../lib/skill-history"
import { SPELL_SCHOOLS } from "../lib/dcss-skills"

function usage() {
  console.log("Usage: pnpm ts-node scripts/debug-skill-history.ts <morgue-path>")
  process.exit(1)
}

async function main() {
  const morguePath = process.argv[2]
  if (!morguePath) {
    usage()
  }

  const resolved = path.resolve(morguePath)
  const raw = fs.readFileSync(resolved, "utf8")

  const history = parseSkillHistory(raw)
  if (!history) {
    console.error("No Skill Usage History block found in morgue.")
    process.exit(1)
  }

  console.log(`Parsed skills for file: ${resolved}`)
  console.log("Spell schools at XL 25:")

  const rankCheckpoint = 25
  type Sample = { xl: number; level: number }

  function levelAt(samples: Sample[], xl: number): number | null {
    let last: Sample | null = null
    for (const s of samples) {
      if (s.xl > xl) break
      last = s
    }
    return last ? last.level : null
  }

  const schoolLevels: { school: string; level: number }[] = []
  for (const school of SPELL_SCHOOLS) {
    const series = history[school]
    if (!series) continue
    const lvl = levelAt(series.samples, rankCheckpoint)
    if (lvl == null) continue
    schoolLevels.push({ school, level: lvl })
  }

  schoolLevels.sort((a, b) => b.level - a.level)
  for (const { school, level } of schoolLevels) {
    console.log(`  ${school.padEnd(15)} XL ${rankCheckpoint}: ${level}`)
  }

  console.log("\nRanked spell schools (1–4) with levels at checkpoints 5/10/15/20/25:")
  const checkpoints = [5, 10, 15, 20, 25]
  const top = schoolLevels.slice(0, 4)
  const labels = ["Spell School 1", "Spell School 2", "Spell School 3", "Spell School 4"]

  for (let i = 0; i < top.length; i++) {
    const { school } = top[i]!
    const series = history[school]!
    const levels = checkpoints.map((cp) => levelAt(series.samples, cp) ?? null)
    console.log(
      `${labels[i]} (${school}): ` +
        levels
          .map((v, idx) => (v == null ? `XL${checkpoints[idx]}: -` : `XL${checkpoints[idx]}: ${v}`))
          .join(", "),
    )
  }

  console.log("\nFull snapshots that would be emitted for this morgue (all skills):")
  const snapshots = computeSkillSnapshotsFromHistory(history)
  for (const s of snapshots) {
    if (s.skill_group.startsWith("Spell School")) {
      console.log(
        `  snapshot: group=${s.skill_group}, xl=${s.checkpoint_xl}, level=${s.level.toFixed(1)}`,
      )
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

