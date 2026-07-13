# KAPS MedTech — Implementation Log

This log documents the details of changes applied during this engineering session.

---

## Log Entries

### 1. Fix JWT Secret Fallback (C1)
- **Problem**: Missing `JWT_SECRET` variables caused the server to silently fall back to `'secret'`, exposing a vulnerability where JWTs could be forged.
- **Reason**: Critical security vulnerability.
- **Solution**: Removed fallback in `routes/auth.js`. Added startup environment check in `server.js` to crash fast if database or secret variables are not configured.
- **Files Modified**: 
  - `backend/routes/auth.js`
  - `backend/server.js`
- **Risk Level**: Low (expected path for secure startup).
- **Testing Performed**: Checked env check triggers manually.
- **Expected Improvement**: Zero risk of using weak signature keys.

### 2. Authorization Guards on Sensitive Endpoints (C2, C3)
- **Problem**: Any authenticated token could read medical records (`GET /api/appointments/:id/record`) or modify appointments (`PUT /api/appointments/:id/reschedule` and `/api/doctor/cancel`) without ownership verification.
- **Reason**: Critical security vulnerability.
- **Solution**: Added patient ownership and clinician scope queries checking `patient_id` or `doctor_id` before database action.
- **Files Modified**: 
  - `backend/routes/appointments.js`
  - `backend/routes/doctor.js`
- **Risk Level**: Low.
- **Testing Performed**: Ensured query check triggers return 403.
- **Expected Improvement**: Full resource isolation matching session profiles.

### 3. Centralized Error Handling & Input Validation (H1, H2)
- **Problem**: Database syntax errors, unique constraint exceptions, and other details were sent to clients. Signup accepted unvalidated data.
- **Reason**: Exposure of schema internals and lack of database data validation.
- **Solution**: Added error middleware wrapping route calls. Implemented email validation regex, minimum password requirements, and role checks.
- **Files Modified**: 
  - `backend/middleware/errorHandler.js` [NEW]
  - `backend/routes/auth.js`
  - `backend/routes/appointments.js`
  - `backend/routes/doctor.js`
  - `backend/server.js`
- **Risk Level**: Low.
- **Testing Performed**: Checked error handling payload structures.
- **Expected Improvement**: Clean client-facing error payloads.

### 4. Remove Dead Code (H5)
- **Problem**: 13 unused debugging/testing/flat-store files cluttered the repository.
- **Reason**: Confusing code smell and data exposure.
- **Solution**: Deleted 13 dead code files and legacy `data/` folder.
- **Files Modified**: Deleted files: `diagnose.js`, `debug_hash.js`, `debug_records.js`, `debug_records_full.js`, `debug_user.js`, `generate_hash.js`, `reset_pwd.js`, `test_cardio_login.js`, `test_db.js`, `test_doctor_signup.js`, `test_endpoint.js`, `test_medicine_expiry.js`, `data/store.json`.
- **Risk Level**: Low.
- **Testing Performed**: Checked server starts and functions correctly.
- **Expected Improvement**: Cleaned directory map.

### 5. Script and Style Extraction (H6, H7)
- **Problem**: In-file CSS rules and massive JS scripts were mixed in HTML templates.
- **Reason**: Poor separation of concerns and maintainability.
- **Solution**: Extracted and modularized JavaScript components into `frontend/js/`. Moved style sheets to `frontend/css/style.css` and added definitions for 30+ missing utility classes.
- **Files Modified**:
  - `frontend/index.html`
  - `frontend/dashboard_user.html`
  - `frontend/dashboard_doctor.html`
  - `frontend/css/style.css`
  - `frontend/js/login.js` [NEW]
  - `frontend/js/dashboard_user.js` [NEW]
  - `frontend/js/dashboard_doctor.js` [NEW]
- **Risk Level**: Medium (requires checking event hook names match form IDs).
- **Testing Performed**: Verified script tags import cleanly.
- **Expected Improvement**: Cacheable frontend resources.

### 6. Mobile Responsiveness (H8)
- **Problem**: Desktop-only layout design was unusable on mobile sizes.
- **Reason**: Missing styling layout rules.
- **Solution**: Added CSS media breakpoints (<1024px, <768px, <480px) to stack forms, collapse sidebars, and stack columns dynamically.
- **Files Modified**:
  - `frontend/css/style.css`
- **Risk Level**: Low.
- **Testing Performed**: Verified design layouts reflow correctly on small viewports.
- **Expected Improvement**: Accessible responsive viewport.

### 7. Automated API Integration Testing Script
- **Problem**: Lack of automated regression tests for backend APIs and security access rules.
- **Reason**: QA and security regression validation.
- **Solution**: Developed `backend/integration_test.js` validating all login, signup, booking, conflict check, and access control checks programmatically.
- **Files Modified**:
  - `backend/integration_test.js` [NEW]
  - `backend/init_db.js`
  - `backend/db.js`
- **Risk Level**: Low.
- **Testing Performed**: Ran 29/29 tests successfully on local server connected to Supabase database.
- **Expected Improvement**: Prevents future regressions and provides a quick verification method.
