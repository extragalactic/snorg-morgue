/**
 * Verify the request carries a valid Supabase user JWT (any authenticated user).
 * Used for browse APIs that return another user's public dashboard data.
 */

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

export async function requireAuthenticatedUser(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase service client admin typings vary by version
  getSupabase: () => any,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; body: { error: string } }
> {
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
  if (error || !data?.user?.id) {
    return { ok: false, status: 401, body: { error: "Invalid or expired session" } }
  }

  return { ok: true, userId: data.user.id }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}
