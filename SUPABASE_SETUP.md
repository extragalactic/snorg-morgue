# Supabase setup for snorg-morgue

You already have the **API URL** and **anon key**. Here’s what to do (or confirm) in the Supabase dashboard and locally.

---

## 1. Environment variables (local)

Create a `.env.local` in the project root (same folder as `package.json`) with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Get both values from the Supabase dashboard: **Project Settings → API** (Project URL and anon public key).

---

## 2. Supabase dashboard – email/password auth

- **Authentication → Providers**
- **Email** should be **Enabled** (it is by default).
- No extra tables are required: Supabase stores users in **Authentication → Users** automatically.

You don’t need to create any tables for sign-up/sign-in with email and password.

---

## 3. (Optional) Google sign-in

If you want “Sign in with Google”:

1. **Authentication → Providers → Google**
   - Turn **Enable Sign in with Google** **On**.
   - Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
     - Application type: **Web application**
     - Authorized redirect URIs: add  
       `https://<your-project-ref>.supabase.co/auth/v1/callback`  
       (Supabase shows this exact URL in the Google provider settings).
   - Paste the **Client ID** and **Client secret** into the Supabase Google provider and save.

2. **Authentication → URL configuration**
   - **Site URL**: set to your app’s origin, e.g. `http://localhost:3000` (dev) or `https://yourdomain.com` (prod).
   - **Redirect URLs**: add:
     - `http://localhost:3000/auth/callback` (dev)
     - `https://yourdomain.com/auth/callback` (prod when you deploy)

Without this, only email/password auth will work; Google sign-in will fail until the provider and redirect URLs are set.

---

## 4. Email confirmation (optional)

- **Authentication → Providers → Email**
- **Confirm email** is **On** by default: new users must click a link in the email before they can sign in.
- To let users sign in immediately without confirming, turn **Confirm email** **Off** (useful for local testing).

---

## 5. Summary

| Task | Required? |
|------|-----------|
| Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local` | **Yes** |
| Create tables for users | **No** (Supabase Auth handles it) |
| Enable Email provider | **No** (already on) |
| Configure Google provider + redirect URLs | **Only if you use Google sign-in** |
| Set Site URL and Redirect URLs for auth | **Yes for Google**; good practice for email too |

After setting the env vars, run `pnpm dev` and use **Sign Up** then **Sign In** on the login page.
