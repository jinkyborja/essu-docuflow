# ESSU DocuFlow

Document request portal for the **Eastern Samar State University Graduate School**.
Students request academic documents online; staff review, approve, and release them.

SvelteKit 2 (Svelte 5 runes) · Tailwind 4 · TypeScript · MySQL · Supabase Storage · Resend

- [FEATURES.md](./FEATURES.md) — what the app does, in plain language
- [TODO.md](./TODO.md) — outstanding work, known gaps, and client requests
- [database/migrations/](./database/migrations/) — schema migrations

---

## ⚠️ Read this first

Four things that will bite you if you don't know them.

**1. There is no staging. `.env` points at the live production database.**
When you run `npm run dev` and click around, you are writing real data that real
students can see. There is exactly one database (`defaultdb`). Before testing
anything destructive, either work on a throwaway record you created yourself, or
stand up a copy (see [Rehearsing a migration](#rehearsing-a-migration)).

**2. Never run `database/db.sql` against the live database.** It drops and
recreates every table. It is a reference of the current shape and a bootstrap for
a fresh environment — not a migration.

**3. Passwords are unsalted SHA-256.** Not bcrypt, not argon2. This is a known
gap tracked in TODO.md. Don't copy the pattern into new code.

**4. Third-party services have gone down mid-development twice.** The Supabase
project became DNS-unresolvable (free-tier pause) and the Resend sender domain
was retired. When uploads or emails fail, check the service is actually reachable
before debugging the code — see [Troubleshooting](#troubleshooting).

---

## Setup

Requires Node (developed on v24) and access to the MySQL, Supabase, and Resend
accounts.

```sh
npm install
```

Create `.env` in this directory — all nine are required and read at build time
via `$env/static/private`, so a missing one fails the build, and changing one
needs a restart:

```sh
# MySQL
DB_HOST=...
DB_PORT=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=defaultdb

# Resend (transactional email)
RESEND_API=re_...

# Session/token signing — long random string
JWT_SECRET=...

# Supabase Storage
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

**Supabase** needs two Storage buckets: `requirements` (student uploads and
released documents) and `templates` (blank forms students download).

**Resend** must have the sender domain verified. The sender lives in one place,
`src/lib/server/email.ts` — if mail silently stops, that domain is the first
suspect.

### Fresh database

```sh
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < database/db.sql
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p "$DB_NAME" < database/seed.sql   # optional
```

## Run

```sh
npm run dev        # http://localhost:5173
npm run check      # svelte-check — expect 0 errors, ~104 pre-existing a11y warnings
npm run build
```

`/` redirects by session role: to `/login` when signed out, otherwise to
`/student/dashboard` or `/staff/dashboard`.

---

## Architecture

### Roles

| Role | Can do |
|---|---|
| `Student` | Register, request documents, upload requirements, resubmit, track status |
| `Staff` | Review and approve/reject/request corrections, manage documents and templates |
| `Admin` | Everything staff can, plus student and staff management |

`Admin` shares the staff UI — there is no separate admin portal. Admin-only nav
items are gated by `adminOnly` in `src/routes/staff/+layout.svelte`, **and** the
endpoints check the role themselves. Do both; the nav gate alone is not security.

### Auth

Hand-rolled HMAC-SHA256 JWT (`src/lib/server/jwt.ts`) in an httpOnly `session`
cookie. No `jsonwebtoken`/`jose` dependency. Every protected route guards in its
`+layout.server.ts` / `+page.server.ts`.

There is **no client-side auth store**. Components read session data from
`page.data.layoutUser`, which both portal layouts provide.

### Data access

A single `mysql2` pool (`src/lib/server/db.ts`). Server loads query it directly
and return rows; there is no ORM. Rows are typed loosely as
`Record<string, unknown>` — `src/lib/types/index.ts` holds only the enums that
mirror the schema and the few shared component types.

**Requirements are relational — do not reintroduce JSON.** They used to be JSON
blobs in `documents.requirements` / `requests.requirements`. They now live in
`requirements` / `document_requirements` / `request_requirements`. Go through
**`src/lib/server/requirements.ts`**, which returns the same shape the UI has
always consumed:

```ts
{ name, description, in_person, file_path, file_name, submitted_at, needs_correction }
```

Use `fetchDocumentRequirements` / `fetchRequestRequirements` (both batch, so no
N+1) for reads, and `replaceDocumentRequirements` / `replaceRequestRequirements`
inside a transaction for writes.

### Files

Uploaded to Supabase Storage; MySQL stores only the path. Downloads go through
short-lived signed URLs (`/api/storage`).

**Upload failures must never be swallowed.** All three upload paths return a real
error and refuse to persist a half-written record. A silent failure previously
saved `file_path: null` and both portals showed "Not yet submitted" with no
explanation, which was invisible for weeks.

### Email

Resend, sender centralized in `src/lib/server/email.ts`. Account verification
uses a **Resend dashboard-hosted template** (`email-verification`) — its content
is not in this repo. Status emails (approved / rejected / corrections) are inline
HTML in `src/routes/api/requests/[id]/+server.ts`.

Always check the send result. Failures return `email_warning` so staff are told
the status changed but the notification didn't send, rather than seeing a false
success.

---

## Database

Nine tables. Normalized to 3NF in September 2026 — see
[database/migrations/](./database/migrations/).

```
programs ──< users ──< requests >── documents
                        │  │            │
purposes ───────────────┘  │            │
                           │            │
      request_requirements >── requirements ──< document_requirements
                           │
    request_status_history
```

| Table | Purpose |
|---|---|
| `programs` | "Units of Education" — the graduate programs. `users.program_id` |
| `purposes` | Why a document is requested. `requests.purpose_id` |
| `requirements` | Master list of requirement types, defined once |
| `users` | All three roles in one table, role-specific columns nullable |
| `documents` | Requestable document types, with optional template |
| `requests` | One row per student request, `VARCHAR` PK like `REQ-2026-001` |
| `document_requirements` | Which requirements a document asks for |
| `request_requirements` | What the student submitted per requirement |
| `request_status_history` | Audit trail; `is_read`/`student_read` drive the badges |

### Legacy columns — do not use, do not drop yet

`documents.requirements`, `requests.requirements`, `users.program`, and
`requests.purpose` still exist and are still written to. They are the rollback
safety net for the 3NF migration. Read from the relations/FKs instead. Dropping
them is a tracked follow-up; rollback stops being trivial afterwards.

### Rehearsing a migration

Never test a migration on live. Copy it first:

```sh
mysqldump --set-gtid-purged=OFF --no-tablespaces <conn> defaultdb > backup.sql
mysql <conn> -e "CREATE DATABASE rehearsal"
mysql <conn> rehearsal < backup.sql
```

Point `DB_NAME` at `rehearsal`, apply the migration, verify, then apply to live.
`--set-gtid-purged=OFF` matters — Aiven rejects the GTID statements a plain dump
emits.

**Seed representative data before migrating.** Tables are often nearly empty, so
a migration against them passes trivially while proving nothing. Cover the edge
cases: missing files, in-person requirements, correction flags, empty arrays,
NULLs.

---

## Layout

```
src/
├── lib/
│   ├── components/
│   │   ├── ui/          Badge, Modal, Pagination, EmptyState, ErrorState, Timeline…
│   │   ├── forms/       Select (custom dropdown), FileUpload, FilterBar
│   │   └── layout/      Sidebar, TopBar
│   ├── data/            programs, purposes, student-types — client-supplied lists
│   ├── server/          db, jwt, email, supabase, requirements  (server-only)
│   ├── stores/          sidebar + notification UI state
│   └── types/           enums mirroring the DB, shared component types
└── routes/
    ├── api/             17 endpoints, 26 methods
    ├── login, accept-invite, reset-password
    ├── staff/           staff + admin portal
    └── student/         student portal
```

Not everything server-side is in `api/`. **13 `+page.server.ts` / `+layout.server.ts`
loaders query MySQL directly** — dashboards, lists, reports. `api/*` handles
mutations and anything the client calls with `fetch`.

### Conventions worth keeping

- **Custom `Select` has no native validation.** It isn't a `<select>`, so
  `required` does nothing. The submitting form must check the value itself.
- **404 pages need a catch-all route.** SvelteKit runs *no layout* for an
  unmatched URL, so a scoped `+error.svelte` renders bare. `staff/[...path]` and
  `student/[...path]` exist so the URL matches and the portal shell renders.
- **Flex children need `min-w-0` to shrink.** Long filenames overflowed four
  upload labels because without it a flex child won't go below its content width
  — `break-words` alone doesn't help.

---

## Troubleshooting

**Uploads fail / "fetch failed"** — check Supabase is reachable before reading
code. It has been DNS-unresolvable twice (project pause):

```sh
nslookup <your-project>.supabase.co 8.8.8.8
```

**Emails don't arrive** — check the sender domain is verified in Resend. A
retired domain makes every send fail. Also check spam; a newly verified domain
has no sending reputation.

**Weird behaviour that ignores your changes** — you may have stale dev servers.
Vite silently moves to 5174, 5175… when a port is taken, so you end up testing an
old build. Confirm the port in the startup output, and kill strays:

```powershell
Get-NetTCPConnection -State Listen -LocalPort (5173..5180) |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

**Deleting a user fails** — three FKs reference `users`. Deletion must remove
dependent rows first; `src/routes/api/students/+server.ts` shows the transactional
pattern.
