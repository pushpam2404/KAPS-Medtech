# Deploying

The project was set up for Vercel (app) and Neon (PostgreSQL), both on free plans. Any Node host and any PostgreSQL 14+ works.

## Database

1. Create a project on [Neon](https://neon.tech) and copy the connection string (it ends in `?sslmode=require`).
2. Load the schema from your machine:

   ```bash
   DATABASE_URL="postgresql://..." npm run db:init
   ```

   `schema.sql` drops and recreates every table. Run it on an empty database only.

   If the database already exists and you only need the booking constraint, run the `CREATE UNIQUE INDEX` statement at the top of `backend/schema.sql`.

Neon pauses free projects that sit idle, and may remove them after a long time. If `/api/health` reports `Database connection failed`, check the Neon dashboard first.

## Vercel

Import the repository and add these environment variables:

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | the Neon string |
| `JWT_SECRET` | yes | at least 32 random characters: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DOCTOR_SIGNUP_CODE` | no | leave unset to switch doctor self-registration off |
| `ALLOWED_ORIGINS` | no | only if another website calls the API |

Changing `JWT_SECRET` signs everyone out.

## After deploying

- The seeded doctors (`gp1@health.edu` ... `dent5@health.edu`) all use the password `password123`. That is fine for a demo and wrong for real use. Change those hashes, or delete the rows, before anything real goes in.
- Open `/api/health`. Then sign in and book a visit.
