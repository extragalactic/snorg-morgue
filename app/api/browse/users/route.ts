import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireAuthenticatedUser } from "@/lib/browse-auth"
import { usernameSlugFromAuthUser } from "@/lib/auth-display-slug"

export interface BrowseUserListItem {
  id: string
  usernameSlug: string
}

/**
 * All registered users for the Browse picker. Includes users without a `profiles` row
 * (e.g. OAuth-only accounts) using the same slug rules as session display names.
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
    const { data: profileRows } = await supabase.from("profiles").select("id, username_slug")
    const slugByUserId = new Map<string, string>()
    for (const row of profileRows ?? []) {
      const r = row as { id: string; username_slug: string }
      if (r.id && r.username_slug) slugByUserId.set(r.id, r.username_slug)
    }

    const users: BrowseUserListItem[] = []
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

    return NextResponse.json({ users })
  } catch (e) {
    console.error("[browse/users]", e)
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 })
  }
}
