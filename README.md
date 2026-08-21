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

## Admissions enquiry integration

The admissions form uses a Server Action to validate enquiries on the server. It only confirms success when the optional `ADMISSIONS_WEBHOOK_URL` server environment variable is configured and its endpoint accepts the request.

Configure this value in Vercel (and locally in `.env.local`) with a secure HTTPS endpoint that stores the validated enquiry and/or notifies the school. The endpoint should accept a JSON POST body. Without it, the form fails safely and does not claim that an enquiry has been stored.
