# ESSU DocuFlow Backend Prompt

I have a SvelteKit project called "essu docuflow" (frontend source code only,
backend not yet set up). I need you to build the backend inside SvelteKit
using server-side load functions, form actions, and API route handlers
(+page.server.ts, +server.ts). There is no separate backend service.

## TECH STACK (must follow exactly)
- Framework: SvelteKit (TypeScript)
- Database: MySQL hosted on Aiven, accessed directly with `mysql2` (promise
  API, connection pool). No ORM. Use parameterized queries only.
  Aiven requires SSL, so configure the pool with the CA certificate from env
  (DB_CA holds the PEM text).
- File storage: Supabase Storage (service_role key, server-side only) for
  uploaded files and document templates. Supabase is NOT the database.
  Buckets stay private; serve files through signed URLs.
- Email: Brevo transactional email API (https://api.brevo.com/v3/smtp/email)
  called with fetch and the `api-key` header. No SDK needed.
- Auth: custom HMAC-SHA256 JWT stored in an HTTP-only, Secure, SameSite=Lax
  cookie. Validate it in `hooks.server.ts` and put the user in
  `event.locals`. Hash passwords with bcrypt or argon2.
- Secrets: read only from `$env/static/private` or `$env/dynamic/private`.
  Never expose them to client code or `PUBLIC_` variables.
- Database tooling: I manage the Aiven database with HeidiSQL, so provide
  `schema.sql` as a plain MySQL script I can run in HeidiSQL.

## WHAT I NEED THE BACKEND TO DO   <-- FILL THIS IN

1. Users and roles:
   - Roles: [admin, staff, student]  (change to your real roles)
   - Admin: [manage users, manage templates, see all documents]
   - Staff: [review and approve/reject documents]
   - Student: [upload and track own documents]

2. Authentication:
   - [register, login, logout, forgot/reset password by email]
   - [who can register? open signup or admin creates accounts?]

3. Documents:
   - [upload, list, view, download, delete]
   - [allowed file types: pdf, docx, jpg, png]
   - [max file size: 10 MB]
   - [statuses: draft, submitted, under review, approved, rejected]

4. Templates:
   - [admin uploads document templates; everyone can download them]

5. Workflow:
   - [student submits -> staff reviews -> approve/reject with remarks]

6. Emails to send (Brevo):
   - [on submission, on approval/rejection, on password reset]

7. Other features:
   - [activity logs, search and filter, dashboard counts]

## PAGES THAT NEED DATA   <-- FILL THIS IN
[List each route in src/routes and what it should load or submit, e.g.
 /login: sign in
 /dashboard: counts and recent documents
 /documents: list with search and filter
 /documents/[id]: details, download, approve/reject
 /templates: list and download, admin upload
 /admin/users: manage users]

## DELIVERABLES
1. `schema.sql` for MySQL (tables, keys, indexes, timestamps), runnable in HeidiSQL.
2. `src/lib/server/db.ts`: mysql2 pool with Aiven SSL.
3. `src/lib/server/auth.ts`: JWT sign/verify, password hashing, cookie helpers.
4. `src/lib/server/storage.ts`: Supabase upload, signed URL, delete helpers.
5. `src/lib/server/email.ts`: Brevo send helper and email templates.
6. `src/hooks.server.ts`: auth check and route protection by role.
7. `+page.server.ts` / `+server.ts` for each route, wired to my existing frontend.
8. `.env.example` with: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_CA,
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DOCUMENTS_BUCKET,
   SUPABASE_TEMPLATES_BUCKET, BREVO_API_KEY, BREVO_SENDER_EMAIL,
   BREVO_SENDER_NAME, JWT_SECRET.
9. Short setup steps: create the two Supabase buckets, connect HeidiSQL to
   Aiven with SSL, run schema.sql, verify the Brevo sender, start locally.

## RULES
- Read my existing project files first (start with src/routes) and match their
  structure, naming, and styles. Don't rewrite the UI.
- Validate all input on the server. Check authorization on every endpoint.
- Limit upload size and file types. Sanitize file names.
- Return proper HTTP status codes and clear error messages.
- Explain any assumption instead of silently guessing.
- Work in stages: (1) database + auth, (2) documents + Supabase storage,
  (3) Brevo emails. Stop after each stage so I can test.