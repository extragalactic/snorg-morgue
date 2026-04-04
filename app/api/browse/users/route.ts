import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireAuthenticatedUser } from "@/lib/browse-auth"
import { usernameSlugFromAuthUser } from "@/lib/auth-display-slug"

export interface BrowseUserListItem {
  id: string
  usernameSlug: string
  /** From `user_stats.total_wins`; 0 if no stats row. */
  totalWins: number
}

/**
 * Browseable players for the signed-in viewer: all registered users who opted in to sharing,
 * except the viewer themselves. Same slug rules as session display names (incl. OAuth-only).
 */
export async function GET(request: Request) {
  let supabase: ReturnType<typeof createServerSupabase>
  try {
    supabase = createServerSupabase()
  } catch {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 })
  }

  const authResult = await requireAuthenticatedUser(request, () => supabase)
  if (!authResult.ok) {
    return NextResponse.json(authResult.body, { status: authResult.status })
  }

  try {
    const viewerId = authResult.userId

    const { data: profileRows } = await supabase.from("profiles").select("id, username_slug")
    const slugByUserId = new Map<string, string>()
    for (const row of profileRows ?? []) {
      const r = row as { id: string; username_slug: string }
      if (r.id && r.username_slug) slugByUserId.set(r.id, r.username_slug)
    }

    const users: { id: string; usernameSlug: string }[] = []
    let page = 1
    const perPage = 1000

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
      if (error) {
        return NextResponse.json(
          { error: error.message ?? "Failed to list users" },
          { status: 500 },
        )
      }
      const list = data?.users ?? []
      for (const u of list) {
        const id = u.id
        if (!id) continue
        const meta = u.user_metadata as Record<string, unknown> | undefined
        if (meta?.browse_sharing_enabled === false) continue
        const fromProfile = slugByUserId.get(id)
        const usernameSlug =
          fromProfile?.trim() ||
          usernameSlugFromAuthUser({
            user_metadata: u.user_metadata as Record<string, unknown> | undefined,
            email: u.email,
          })
        users.push({ id, usernameSlug })
      }
      if (list.length < perPage) break
      page++
    }

    users.sort((a, b) => a.usernameSlug.localeCompare(b.usernameSlug, undefined, { sensitivity: "base" }))

    const winsByUserId = new Map<string, number>()
    const { data: statsRows } = await supabase.from("user_stats").select("user_id, total_wins")
    for (const row of statsRows ?? []) {
      const r = row as { user_id: string; total_wins: number | null }
      if (r.user_id) {
        winsByUserId.set(r.user_id, Number(r.total_wins) || 0)
      }
    }

    const usersWithWins: BrowseUserListItem[] = users
      .filter((u) => u.id !== viewerId)
      .map((u) => ({
        ...u,
        totalWins: winsByUserId.get(u.id) ?? 0,
      }))

    return NextResponse.json({ users: usersWithWins })
  } catch (e) {
    console.error("[browse/users]", e)
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 })
  }
}
