# Team Onboarding — Getting the Repo Running

Get Q-Learn running locally after cloning. Local development uses **Docker
Postgres** for the app database; **Auth and Realtime** point at the shared cloud
Supabase project.

> **Prerequisites:** Node.js 20+, Python 3.11+, pnpm, Docker & Docker Compose v2+.

---

## 1. Clone and create env files

```bash
git clone <repo-url>
cd Q-Learn

cp .env.example .env                       # root (frontend public vars)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

## 2. Fill in the Supabase variables

We all share **one** Supabase project (ref `gwljzmjsuznwsdnqxxwu`,
`https://gwljzmjsuznwsdnqxxwu.supabase.co`). Some values are public; some are
secret and are shared privately — **never commit real secrets** (`.env`,
`.env.local`, `.env.production` are gitignored).

| Variable | File | Public? | Where to get it |
|----------|------|---------|-----------------|
| `SUPABASE_URL` | `backend/.env` | ✅ public | The URL above |
| `NEXT_PUBLIC_SUPABASE_URL` | `frontend/.env.local` | ✅ public | The URL above |
| `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | backend + frontend | ✅ public | Dashboard → Settings → API → anon key (or ask the team) |
| `SUPABASE_SERVICE_KEY` | `backend/.env` | 🔒 secret | **Ask the team lead** (Dashboard → Settings → API → service_role) |
| `SUPABASE_JWT_SECRET` | `backend/.env` | 🔒 secret | **Ask the team lead** (Dashboard → Settings → API → JWT Settings) |
| `SECRET_KEY` | `backend/.env` | 🔒 local | Any random string (`python -c "import secrets;print(secrets.token_urlsafe(48))"`) |

`DATABASE_URL` in `backend/.env` should stay pointed at Docker for local dev:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/qlearn
```

> The shared **production** DB URLs (Supabase pooler / direct) live in
> `backend/.env.production` and are set as Railway env vars — you don't need them
> for local work. See [infrastructure.md](infrastructure.md).

## 3. Start the stack

```bash
docker compose up --build          # postgres + api + web
```

- Frontend → http://localhost:3000
- API → http://localhost:8000 · docs → http://localhost:8000/docs

## 4. Run database migrations (local Docker DB)

```bash
cd backend
alembic upgrade head               # applies through b2c3d4e5f6a7
```

The **cloud** Supabase DB is already migrated — you only migrate your local
Docker DB.

---

## How auth works now

Auth is **Supabase Auth**, not custom JWT:

- The frontend signs in with `@supabase/supabase-js` (`hooks/useAuth.ts`) —
  email/password **or** Google — and sends the Supabase access token as
  `Authorization: Bearer <token>`.
- The backend **verifies** that token and syncs a `public.users` row that owns
  `role` / `subscription_status`. Only `GET /api/v1/auth/me` remains — there are
  no `register` / `login` / `refresh` API endpoints. `_sync_user()` provisions
  the local user from the token `sub`, so **any** provider works with no backend
  change.
- If `SUPABASE_JWT_SECRET` is wrong or missing, every authenticated request
  fails with 401. It must be the project's real JWT secret.

### Google sign-in (OAuth)

`loginWithGoogle` (`hooks/useAuth.ts`) calls `supabase.auth.signInWithOAuth`,
Google redirects back to `app/auth/callback/page.tsx`, and that page finishes the
session (stores the JWT, sets the `qlearn-auth` cookie, fetches `/api/v1/auth/me`,
redirects to `/dashboard`). This needs no local env vars, but the shared Supabase
project must have it configured (already done for the team):

- **Auth → Providers → Google** enabled with a Google Cloud OAuth Client ID +
  Secret (Google's authorized redirect URI is the Supabase callback
  `https://gwljzmjsuznwsdnqxxwu.supabase.co/auth/v1/callback`).
- **Auth → URL Configuration → Redirect URLs** allow-lists both
  `http://localhost:3000/auth/callback` and the production
  `.../auth/callback` — a redirect URL not on this list falls back to the Site URL.

### Skipping login during development

To open every page without signing in while building UI, set this in
`frontend/.env.local` and restart `pnpm dev` (Next.js reads env files only at
startup):

```
NEXT_PUBLIC_DEV_NO_AUTH=1
```

The Edge middleware then skips route protection and `/` lands on `/dashboard`.
It's **double-gated** — active only when `NODE_ENV != production` **and** the flag
is `1` — so it can never bypass auth in a production build. Set it back to `0` (or
remove it) to test the real Supabase login flow. One-off alternative without the
flag: run `document.cookie = "qlearn-auth=1; path=/"` in the browser console, which
satisfies the middleware's cookie check.

## Troubleshooting

- **401 on `/api/v1/auth/me`** → `SUPABASE_JWT_SECRET` is not the project's real
  JWT secret. Re-copy it from Dashboard → Settings → API → JWT Settings.
- **Port 5432 already in use** → a host Postgres is occupying it; stop it or
  change the local port mapping in `docker-compose.yml`.
- **Realtime/Auth not working** → confirm `SUPABASE_URL` and the anon key point
  at the shared project (not the `your-project` placeholder).
