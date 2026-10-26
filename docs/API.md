# API

All routes live under `/api`. Bodies and responses are JSON. Errors look like `{ "error": "message" }`.
Protected routes need `Authorization: Bearer <token>` from the login response. Tokens last one hour.
A missing, invalid or expired token gives 401. A valid token without permission gives 403.

Dates are `YYYY-MM-DD`. Times are `HH:MM` and must be one of the half-hour slots from 09:00 to 16:30.

## Auth

`POST /api/auth/signup`

| Field | Notes |
| --- | --- |
| `name` | required, up to 100 characters |
| `email` | required, up to 100 characters, stored lowercase |
| `password` | required, 8 to 72 bytes |
| `role` | `student`, `staff` or `doctor` |
| `identifier`, `phone` | optional, up to 50 and 20 characters |
| `department`, `specialty`, `doctor_code` | doctors only. `department` must be one of the 13 listed in `backend/lib/clinic.js`. `doctor_code` must equal the server's `DOCTOR_SIGNUP_CODE`. |

Returns 201 on success, 400 for bad input, 403 for a doctor signup without a valid code (or when the server has no code set), 409 if the email exists.

`POST /api/auth/login` with `{ email, password }` returns `{ token, role, name, id }`, or 401 with the same message for an unknown email and a wrong password. This route and signup share a limit of 30 requests per 15 minutes per IP.

## Patients (any logged-in user)

| Route | What it does |
| --- | --- |
| `GET /api/appointments/symptoms?q=` | Symptom dictionary. With `q`, up to 10 rows ranked by how well they match the text. No login needed. |
| `GET /api/appointments/doctors?department=` | Doctors, optionally for one department. |
| `GET /api/appointments/slots?doctor_id=&date=` | Free slots for that doctor and day. |
| `POST /api/appointments/book` | Body `{ doctor_id, date, time, symptom }`. 201, or 409 if the slot is taken, 400 for a past date, a time that is not a slot, or an unknown doctor. |
| `GET /api/appointments/my-appointments` | Booked appointments. `?filter=date&start=&end=` or `?filter=reason&q=` returns every status. |
| `PUT /api/appointments/:id/reschedule` | Body `{ date, time }`. Own, still-booked appointments only. |
| `GET /api/appointments/medical-records` | Own records with prescriptions. |
| `GET /api/appointments/:id/record` | One record. Allowed for the patient and the treating doctor. |
| `GET /api/appointments/my-medicine` | Prescriptions whose duration has not run out. A duration that is not a number of days ("ongoing") never runs out. |
| `GET /api/appointments/reminders` | Follow-up dates from today onward. |

The web UI does not call `reschedule` yet.

## Doctors (role `doctor`)

| Route | What it does |
| --- | --- |
| `GET /api/doctor/queue` | This doctor's booked appointments ordered by date and time. |
| `GET /api/doctor/patient/:id` | Contact details and earlier records. 404 unless the patient has an appointment with this doctor. |
| `POST /api/doctor/record` | Completes a booked appointment of this doctor's. Body: `appointment_id`, `diagnosis`, optional `advice`, `follow_up_date`, `prescriptions` (`[{ name, dosage, freq, duration }]`, at most 20), `attached_reports` and `patient_updates` (`{ phone, identifier }`). `attached_reports` is a base64 data URL for PNG, JPEG, WebP, GIF or PDF, about 2 MB at most. All of it happens in one transaction. |
| `POST /api/doctor/cancel` | Body `{ appointment_id }`. Cancels one of this doctor's booked appointments. |

## Other

`GET /api/health` returns 200 when the database answers and 503 when it does not.
