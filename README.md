# Krishna Chaitanya High School website

Official public website and initial staff-management-system interface for Krishna Chaitanya High School, Yerraguntla.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The public website is at `/`, staff sign-in is at `/login`, and the management-system shell is at `/dashboard`.

## Validation

```bash
npm run lint
npm run typecheck
npm run build
```

## Deployment

The repository is a standard Next.js application. Import or connect this existing repository in Vercel; Vercel will automatically detect the framework and use `npm run build`.

## Content and system rollout

The public site uses carefully labelled remote placeholder images from Unsplash. Replace the image URLs in `app/page.tsx` with approved school photography when available.

The management system is an interface and information-architecture foundation only. It does not contain a production database, credentials, live school records, or authentication. Before staff use, connect an approved identity provider, enforce server-side Admin/Teacher roles, configure a database, audit logging and backups.

## Admissions persistence

Admissions enquiries are persisted server-side in Supabase Postgres. The repository uses a focused data-access module at `lib/admissions/repository.ts`, backed by the Vercel-provided pooled `POSTGRES_URL` runtime variable. It uses parameterized SQL and returns only the database-generated enquiry ID and creation timestamp to the Server Action.

The additive migration at `supabase/migrations/20260821180000_create_admission_enquiries.sql` creates the private `admission_enquiries` table, UUID identifiers, database-generated timestamps, status model, indexes, and Row Level Security with no public access policies. Apply it through the linked Supabase project's migration workflow; do not run it again after it has been recorded remotely.

The form shares a Zod validation schema in `lib/admissions/schema.ts`, including the exact class allowlist, Indian mobile normalization to `+91XXXXXXXXXX`, optional email/message normalization, field limits, and a hidden honeypot check. The database is the source of truth: a missing or failed webhook cannot make a saved enquiry fail. A distributed rate-limit store is not configured; an in-memory limiter is intentionally not used on Vercel.

`ADMISSIONS_WEBHOOK_URL` remains optional and is called only after a successful database write. Its failure is logged without enquiry details and does not discard or invalidate the saved enquiry.

### Local development and security

Use a non-production local database environment when available. Vercel Sensitive production variables may not be retrievable as usable plaintext locally; the production deployment receives the server-only integration variables at runtime. Never expose `POSTGRES_URL`, Supabase secret/service keys, or database credentials to client-side code, and never commit `.env.local`, `.env.production.local`, or `.vercel`.
