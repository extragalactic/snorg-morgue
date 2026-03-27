import { slugifyUsername } from "@/lib/slug"

/** Public-ish slug for URLs: profile row if present, else same fallback as auth-context display name. */
export function usernameSlugFromAuthUser(user: {
  user_metadata?: Record<string, unknown>
  email?: string | null
}): string {
  const name =
    (user.user_metadata?.full_name as string) ||
    (user.user_metadata?.name as string) ||
    user.email?.split("@")[0] ||
    "user"
  return slugifyUsername(name)
}
