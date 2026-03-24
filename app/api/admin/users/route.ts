import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase-server"
import { requireAdminEmail } from "@/lib/admin-auth"

export interface AdminUser {
  id: string
  email: string | null
  createdAt: string
  lastSignInAt: string | null
  morgueCount: number
  uploadCount: number
}

export async function GET(request: Request) {
  let supabase
  try {
    supabase = createServerSupabase()
  } catch {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 },
    )
  }

  const authResult = await requireAdminEmail(request, () => supabase)
  if (!authResult.ok) {
    return NextResponse.json(authResult.body, { status: authResult.status })
  }

  try {
    // Fetch morgue counts per user from parsed_morgues (total and manual uploads only)
    const { data: morgueRows } = await supabase
      .from("parsed_morgues")
      .select("user_id, morgue_file_id")

    const countByUserId = new Map<string, number>()
    const uploadCountByUserId = new Map<string, number>()
    for (const row of morgueRows ?? []) {
      const r = row as { user_id: string; morgue_file_id: string | null }
      const uid = r.user_id
      countByUserId.set(uid, (countByUserId.get(uid) ?? 0) + 1)
      if (r.morgue_file_id != null) {
        uploadCountByUserId.set(uid, (uploadCountByUserId.get(uid) ?? 0) + 1)
      }
    }

    const users: AdminUser[] = []
    let page = 1
    const perPage = 1000

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      })

      if (error) {
        return NextResponse.json(
          { error: error.message ?? "Failed to list users" },
          { status: 500 },
        )
      }

      const list = data?.users ?? []
      for (const u of list) {
        users.push({
          id: u.id,
          email: u.email ?? null,
          createdAt: u.created_at ?? "",
          lastSignInAt: u.last_sign_in_at ?? null,
          morgueCount: countByUserId.get(u.id) ?? 0,
          uploadCount: uploadCountByUserId.get(u.id) ?? 0,
        })
      }

      if (list.length < perPage) break
      page++
    }

    return NextResponse.json({ users })
  } catch (e) {
    console.error("[admin/users]", e)
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 },
    )
  }
}
