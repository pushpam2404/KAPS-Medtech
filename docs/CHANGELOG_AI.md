# KAPS MedTech — AI Changelog

All refactoring changes, enhancements, and bug fixes applied to this repository during the engineering session are categorized below.

---

## 1. Security Enhancements

### JWT Secret Fallback Removed
- **Change**: Removed the fallback `'secret'` on `process.env.JWT_SECRET` in `backend/routes/auth.js`.
- **Reason**: Handled a critical vulnerability where missing environment parameters would cause the server to sign tokens with a weak fallback key, allowing authentication bypass.
- **Impact**: Server now fails fast on startup if `JWT_SECRET` is missing.

### Enforced Endpoint Authorization
- **Change**: Added ownership check routines inside `/api/appointments/:id/record` and `/api/appointments/:id/reschedule`.
- **Reason**: Solved a vulnerability that allowed any logged-in user to access another patient's medical records or reschedule other appointments.
- **Impact**: Secure context verification (`patient_id = req.user.id`) guarantees data privacy.

### Doctor Action Scope Restriction
- **Change**: Added query restrictions to `/api/doctor/cancel`.
- **Reason**: Enforced doctor ownership checks to prevent clinicians from cancelling appointments assigned to other doctors.
- **Impact**: Secure cancel validation checks.

### Rate-Limiting Implementation
- **Change**: Added a custom IP-based memory rate-limiter middleware (`backend/middleware/rateLimiter.js`) and applied it to `/api/auth` endpoints in `server.js`.
- **Reason**: Protects against brute-force login attempts and credential stuffing.
- **Impact**: Stricter limits applied to auth endpoints without adding external npm modules.

---

## 2. Architecture & Code Quality

### JS Extraction & Script Cleanup
- **Change**: Extracted ~470 lines of inline script blocks from `index.html`, `dashboard_user.html`, and `dashboard_doctor.html` into clean modules in `frontend/js/`.
- **Reason**: Resolved the code smell of mixing HTML layout with script logic, making JavaScript files cacheable and easy to maintain.
- **Impact**: Modular structure with strict event listener bindings.

### Centralized Error Control
- **Change**: Created `backend/middleware/errorHandler.js` containing an Express error handler and an `asyncHandler` wrapper. Removed internal database exception fields from server payloads.
- **Reason**: Solved database details leakage while making error patterns DRY.
- **Impact**: Detailed errors logged only on the server; clients receive clean, generic error codes.

### CSS Refinement & Class Consolidation
- **Change**: Consolidated page style blocks into `frontend/css/style.css`. Defined 30+ missing utility classes used in the HTML files.
- **Reason**: Cleaned up the style rules, making page layouts consistent and fixing silent style bugs.
- **Impact**: Single stylesheet for the entire application.

---

## 3. Performance & Visual Polish

### Database Indexes
- **Change**: Added indexes to foreign keys (`Appointments(patient_id)`, `Appointments(doctor_id, appointment_date)`, `Doctors(user_id)`, `MedicalRecords(appointment_id)`) in `backend/schema.sql`.
- **Reason**: Prevents full table scans and optimizes query performance.
- **Impact**: Faster dashboard loads.

### Batch Prescription Inserts
- **Change**: Refactored the prescription loop insertion in `/api/doctor/record` to use a single batch INSERT statement.
- **Reason**: Reduces database round-trips from N to 1.
- **Impact**: Improved response time on treatment completion.

### Mobile Responsiveness
- **Change**: Added media queries and fluid responsive styles to `frontend/css/style.css` (break points at `1024px`, `768px`, `480px`).
- **Reason**: Handled broken login screens and sidebar widths on mobile devices.
- **Impact**: Layout reflows and stacks cleanly on mobile viewports.

### Accessibility Fixes (a11y)
- **Change**: Replaced `div` actions with standard `<button>` tags, added focus state rings, skip navigation hints, semantic structure elements (`<header>`, `<main>`, `<section>`), and linked form labels with input fields.
- **Reason**: Enabled full keyboard navigation and screen-reader accessibility.
- **Impact**: Compliance with standard web accessibility guidelines.

### UX Improvements
- **Change**: Replaced blocking browser dialogs (`alert()`, `confirm()`) with a custom non-blocking Toast notification component. Added skeleton screen loaders and empty states.
- **Reason**: Modernized the user feedback interface.
- **Impact**: Premium, app-like visual feedback flow.
