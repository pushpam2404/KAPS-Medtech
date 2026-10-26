# Architecture

One Node process serves both the API and the static frontend.

```
browser (plain HTML, CSS, JS)
   |  fetch /api/...  with a bearer token
   v
Express 5  ->  security headers -> rate limit (auth only) -> routes -> error handler
   |
   v
pg Pool  ->  PostgreSQL
```

On Vercel the same app runs as one serverless function (`vercel.json` sends every path to `backend/server.js`).

## Layout

```
backend/
  server.js        app setup; exports the app so tests can start it on any port
  db.js            pg pool, DATE columns returned as strings
  schema.sql       tables, indexes, demo doctors and symptoms
  init_db.js       loads schema.sql
  routes/          auth, appointments (patients), doctor
  middleware/      JWT check, doctor-only check, rate limiter, error handler
  lib/clinic.js    slots, durations, symptom matching (no database)
  lib/validate.js  input checks (no database)
frontend/          index.html, dashboard_user.html, dashboard_doctor.html, css/, js/
test/unit          tests for lib/
test/integration   API tests against a real PostgreSQL
```

## Data

Six tables: `Users`, `Doctors` (one per doctor user), `Symptoms` (name to department), `Appointments`, `MedicalRecords` (one per completed appointment) and `Prescriptions`.

`Appointments` has a partial unique index on `(doctor_id, appointment_date, appointment_time) WHERE status <> 'Cancelled'`. The booking route does not check first and then insert; it inserts and turns the unique violation into a 409. That is the only approach that holds when two requests arrive together, and `test/integration/api.test.js` fires four at once to check it.

Reports are stored as base64 text in `MedicalRecords.attached_reports`. That is easy but wasteful; object storage would be the next step.

## Access rules

- Patients see only their own appointments, records and medicines.
- A doctor sees a patient only after that patient has booked with them, and can complete or cancel only their own booked appointments. The record route locks the appointment row so a visit cannot be completed twice.
- Doctor accounts cannot be self-registered unless the server has `DOCTOR_SIGNUP_CODE` set. The seeded doctors in `schema.sql` exist so a fresh database works without it.

## Frontend

No framework or build step. Every string from the API goes through `App.esc()` before it is placed in an `innerHTML` template, and the server sends a Content-Security-Policy that blocks inline scripts and styles as a second line of defence. The login token lives in `localStorage`, so an XSS bug would expose it; httpOnly cookies would be the stronger design.

## Known limits

- The rate limiter keeps counts in memory, so on serverless hosting each warm instance counts on its own.
- `db.js` connects to hosted databases with `rejectUnauthorized: false`.
- Slots are fixed (09:00 to 17:00 in half hours for every doctor); the `availability_*` columns in `Doctors` are not used.
- Dates compare against the database server's clock with one day of slack, since users and the server can be in different timezones.
