/**
 * Call the global_analysis_stats RPC and pretty-print the result.
 * Usage (from repo root):
 *   pnpm run rpc:global-stats
 *   node --env-file=.env.local scripts/call-global-stats.js   (Node 20.6+)
 *   node scripts/call-global-stats.js   (loads .env.local automatically if needed)
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (match) {
      const value = match[2].replace(/^["']|["']$/g, '').trim()
      if (!process.env[match[1]]) process.env[match[1]] = value
    }
  }
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  loadEnvLocal()
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  console.error('Run from repo root with .env.local present, or: node --env-file=.env.local scripts/call-global-stats.js')
  process.exit(1)
}

const supabase = createClient(url, key)

async function main() {
  const { data, error } = await supabase.rpc('global_analysis_stats')
  if (error) {
    console.error('RPC error:', error.message)
    process.exit(1)
  }
  console.log(JSON.stringify(data, null, 2))
}

main()
