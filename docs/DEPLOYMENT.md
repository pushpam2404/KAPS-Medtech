# Deploying

The app is a single Node process (`backend/server.js`) plus a PostgreSQL database. It was set up for Vercel with a hosted free database; any Node host and PostgreSQL 14 or newer will do.

## The hosted demo's database is gone

On 26 October 2026 `https://kaps-medtech.vercel.app/api/health` answered `Database connection failed`. The runtime log gave the reason:

```
(ENOTFOUND) tenant/user postgres.<project ref> not found
```

That message comes from Supabase's connection pooler, so the deployment's `DATABASE_URL` points at a Supabase project, not Neon as the old notes said. The pooler no longer knows that project: it was paused for inactivity for too long, or deleted. The Vercel side is fine (deployments are Ready, the function runs). Check the Supabase dashboard first. If the project can be restored, restore it. If not, create a new database as below. The old data cannot be recovered from this repository, and none was ever committed.

## 1. A fresh free database on Neon

1. Sign up at [neon.tech](https://neon.tech) and create a project (any region).
2. Copy the connection string from the dashboard (it ends in `?sslmode=require`).
3. On your machine, with the repository checked out:

   ```bash
   export DATABASE_URL='postgresql://...'   # paste the string; it is not saved anywhere
   ./scripts/setup-neon.sh
   ```

   The script installs dependencies if needed, creates the tables, adds the demo data and reads it back. It never prints the URL. It drops and recreates every table, so run it on an empty database.

Neon certificates chain to Let's Encrypt, so the app verifies them with Node's built-in CA list and no extra settings. `node scripts/check-tls.mjs <host>` checks a server's certificate without logging in.

Supabase's pooler uses its own CA. For a Supabase database set `DATABASE_CA` to its CA certificate (PEM text), or `DATABASE_SSL=relaxed` to encrypt without checking the certificate.

## 2. Vercel

From the repository directory, with the Vercel CLI logged in and the project linked, set the two required variables and redeploy. The values are read from the pipe and not printed:

```bash
printf %s "$DATABASE_URL" | vercel env add DATABASE_URL production
openssl rand -hex 32     | vercel env add JWT_SECRET production
vercel deploy --prod
```

If the variables already exist, remove them first (`vercel env rm DATABASE_URL production --yes`, same for `JWT_SECRET`). Changing `JWT_SECRET` signs everyone out. Add `preview` as well if you use preview deployments.

Optional variables:

| Name | Effect |
| --- | --- |
| `DOCTOR_SIGNUP_CODE` | lets doctors register themselves with this code; unset means they cannot |
| `DEMO_MODE=off` | hides the one-click demo accounts on the sign-in page |
| `ALLOWED_ORIGINS` | only if another website calls the API |
| `DATABASE_SSL`, `DATABASE_CA` | TLS behaviour, see above |

Then open `/api/health`. It should answer `{"status":"OK","db":"Connected"}`.

## Demo data on a database you already have

```bash
npm run db:migrate        # adds the newer tables and columns without dropping anything
npm run db:seed:demo      # adds or refreshes the demo patients and their visits
npm run db:reset:demo     # drops everything, reloads the schema, then seeds
```

The seed commands refuse to run when `NODE_ENV=production` unless `ALLOW_DEMO_SEED=1` is set. They only rebuild the demo patients' appointments and the four demo doctors' hours; other rows stay.

## Before real use

- The 65 seeded doctors share the password `password123`, and the demo patients use it too. Change or delete those accounts and set `DEMO_MODE=off`.
- Read the limits in the README. This project is not built or reviewed for real patient data.
