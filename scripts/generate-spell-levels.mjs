/**
 * Fetches crawl spl-data.h and emits lib/dcss-spell-levels-data.ts
 * Run: node scripts/generate-spell-levels.mjs
 */
import fs from "node:fs"
import https from "node:https"

const OUT = new URL("../lib/dcss-spell-levels-data.ts", import.meta.url)
const URL_SRC =
  "https://raw.githubusercontent.com/crawl/crawl/master/crawl-ref/source/spl-data.h"

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        const chunks = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      })
      .on("error", reject)
  })
}

function parse(content) {
  const start = content.indexOf("static const struct spell_desc spelldata[]")
  if (start === -1) throw new Error("spelldata[] not found")
  const open = content.indexOf("{", start)
  const slice = content.slice(open)
  const endMarker = slice.indexOf("\n#if TAG_MAJOR_VERSION")
  const body = endMarker === -1 ? slice : slice.slice(0, endMarker)
  const entries = []
  const blockRe = /\{\s*\n\s*SPELL_\w+,\s*"([^"]+)",\s*\n([\s\S]*?)\n\},/g
  let m
  while ((m = blockRe.exec(body)) !== null) {
    const name = m[1]
    const rest = m[2]
    if (name === "nonexistent spell") continue
    if (rest.includes("spflag::dummy")) continue
    const lines = rest
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
    const flagIdx = lines.findIndex((l) => l.startsWith("spflag::"))
    if (flagIdx === -1 || flagIdx + 1 >= lines.length) continue
    const levelLine = lines[flagIdx + 1].replace(/,$/, "")
    const level = parseInt(levelLine, 10)
    if (!Number.isFinite(level) || level < 1 || level > 9) continue
    entries.push({ name, level })
  }
  return entries
}

function toTs(entries) {
  const lines = entries.map(
    (e) => `  ${JSON.stringify(e.name)}: ${e.level},`,
  )
  return `/**
 * Auto-generated from crawl/crawl crawl-ref/source/spl-data.h — do not edit by hand.
 * Regenerate: \`node scripts/generate-spell-levels.mjs\`
 */
export const DCSS_SPELL_LEVEL_BY_EXACT_NAME: Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9> = {
${lines.join("\n")}
}
`
}

const content = await fetchText(URL_SRC)
const entries = parse(content)
fs.writeFileSync(OUT, toTs(entries), "utf8")
console.log(`Wrote ${entries.length} spells to ${OUT.pathname}`)
