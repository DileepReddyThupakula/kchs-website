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

## Admissions persistence foundation

The repository includes an additive Postgres migration at `supabase/migrations/20260821180000_create_admission_enquiries.sql`. It creates the `admission_enquiries` table, UUID identifiers, database-generated timestamps, status model, indexes, and Row Level Security with no public access policies.

Persistence is **not configured or operational yet**. Configure a server-only `DATABASE_URL` in Vercel and `.env.local`, use a serverless-compatible Postgres/Supabase connection, and apply the reviewed migration through the chosen provider’s migration workflow. Only then should a server-side repository be connected to the admissions Server Action.

The form now shares a Zod validation schema in `lib/admissions/schema.ts`, including the exact class allowlist, Indian mobile normalization to `+91XXXXXXXXXX`, optional email/message normalization, field limits, and a hidden honeypot check. A distributed rate-limit store is not configured; an in-memory limiter is intentionally not used on Vercel.

`ADMISSIONS_WEBHOOK_URL` remains optional. Once persistence is enabled, it should notify only after a successful database write; a notification failure must not discard the saved enquiry.
