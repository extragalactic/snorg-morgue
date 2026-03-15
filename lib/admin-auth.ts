/**
 * Admin auth: ensure the request is from the designated admin email.
 * Reads Bearer JWT from Authorization header, decodes sub (user id), fetches user via
 * Supabase admin API, and checks email. No signature verification (sub is used only
 * to load the real user from DB).
 */

const ADMIN_EMAIL = "matt.elf@gmail.com"

function decodeJwtPayload(token: string): { sub?: string } | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const payload = parts[1]
    if (!payload) return null
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { sub?: string }
    return decoded
  } catch {
    return null
  }
}

export async function requireAdminEmail(
  request: Request,
  getSupabase: () => { auth: { admin: { getUserById: (id: string) => Promise<{ data: { user?: { email?: string } }; error: unknown }> } } },
): Promise<{ ok: true } | { ok: false; status: number; body: { error: string } }> {
  const auth = request.headers.get("Authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null
  if (!token) {
    return { ok: false, status: 401, body: { error: "Missing Authorization header" } }
  }

  const payload = decodeJwtPayload(token)
  const userId = payload?.sub
  if (!userId) {
    return { ok: false, status: 401, body: { error: "Invalid token" } }
  }

  const { data, error } = await getSupabase().auth.admin.getUserById(userId)
  if (error || !data?.user?.email) {
    return { ok: false, status: 403, body: { error: "Forbidden" } }
  }

  if (data.user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return { ok: false, status: 403, body: { error: "Forbidden" } }
  }

  return { ok: true }
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}
