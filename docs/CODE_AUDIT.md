# KAPS MedTech — Full Code Audit

> **Phase 2: Complete Repository Audit**
> Generated: 2026-07-13
> Auditor: AI Engineering Team

---

## Audit Methodology

Every source file was read line-by-line. Issues are categorized by type and rated by severity:

| Severity | Meaning |
|----------|---------|
| 🔴 **Critical** | Active security vulnerability or data loss risk |
| 🟠 **High** | Significant bug, performance issue, or maintainability blocker |
| 🟡 **Medium** | Code smell, missing best practice, or moderate risk |
| 🟢 **Low** | Minor improvement, style inconsistency, or cleanup opportunity |

---

## 1. Security Audit

### SEC-001: JWT Secret Fallback to Hardcoded String
- **Severity**: 🔴 Critical
- **File**: [auth.js (routes)](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/routes/auth.js#L79)
- **Line**: `process.env.JWT_SECRET || 'secret'`
- **Explanation**: If the `JWT_SECRET` environment variable is not set, the JWT is signed with the literal string `'secret'`. An attacker who discovers this can forge arbitrary tokens, impersonate any user (including doctors), and access all patient data.
- **Impact**: Full authentication bypass. Attacker can forge tokens with any `{id, role, name}` payload.
- **Fix**: Remove the fallback. Fail fast on startup if `JWT_SECRET` is not set. Add a startup validation check.

### SEC-002: No Authorization on Record/Reschedule Endpoints
- **Severity**: 🔴 Critical
- **Files**: [appointments.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/routes/appointments.js#L161-L177), [appointments.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/routes/appointments.js#L231-L253)
- **Explanation**: `GET /api/appointments/:id/record` authenticates the user but never checks whether the appointment belongs to the requesting user. Any authenticated user can read any patient's medical record by guessing appointment IDs (sequential integers). Similarly, `PUT /api/appointments/:id/reschedule` allows any user to reschedule any appointment.
- **Impact**: Patient medical data exposure (HIPAA-level violation in a real system). Unauthorized appointment modification.
- **Fix**: Add ownership check: verify `patient_id = req.user.id` before returning data or allowing modification.

### SEC-003: Doctor Cancel Without Ownership Check
- **Severity**: 🟠 High
- **File**: [doctor.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/routes/doctor.js#L127-L136)
- **Explanation**: Any authenticated doctor can cancel any appointment by passing any `appointment_id`. There's no verification that the appointment belongs to the requesting doctor.
- **Impact**: A doctor could cancel another doctor's appointments.
- **Fix**: Join on Doctors table to verify `doctor_id` matches the requesting user's doctor profile.

### SEC-004: Internal Error Details Exposed to Client
- **Severity**: 🟠 High
- **Files**: All route files
- **Explanation**: Every catch block sends `res.status(500).json({ error: err.message, code: err.code })`. This exposes PostgreSQL error codes, table names, column names, and constraint names to the client.
- **Impact**: Information disclosure aids attackers in crafting SQL injection or understanding schema.
- **Fix**: Return generic error messages to clients. Log detailed errors server-side only.

### SEC-005: CORS Wide Open
- **Severity**: 🟠 High
- **File**: [server.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/server.js#L17)
- **Explanation**: `app.use(cors())` allows requests from any origin with any headers.
- **Impact**: Any malicious website can make authenticated requests to the API if a user's token is accessible.
- **Fix**: Configure CORS with specific allowed origins matching the deployment domain.

### SEC-006: No Rate Limiting
- **Severity**: 🟠 High
- **File**: [server.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/server.js)
- **Explanation**: No rate limiting on any endpoint, especially login and signup.
- **Impact**: Brute-force password attacks, credential stuffing, and API abuse.
- **Fix**: Add `express-rate-limit` with stricter limits on auth endpoints.

### SEC-007: JWT Stored in localStorage
- **Severity**: 🟡 Medium
- **File**: [app.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/js/app.js#L56-L59)
- **Explanation**: Token stored in `localStorage` is accessible to any JavaScript on the page, including XSS payloads.
- **Impact**: If an XSS vulnerability exists, attacker can steal the JWT.
- **Fix**: Consider httpOnly cookies for token storage. For an SPA without a framework, this requires backend changes to set/read cookies.

### SEC-008: Hardcoded Personal Email in Debug Script
- **Severity**: 🟡 Medium
- **File**: [reset_pwd.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/reset_pwd.js#L7)
- **Explanation**: `prsatyarthi2404@gmail.com` is hardcoded — this is a developer's personal email that has been committed to version control.
- **Impact**: Personal data exposure. Also indicates a real user account exists in the production database.
- **Fix**: Remove this file entirely (it's a debug script).

### SEC-009: 50MB JSON Body Limit
- **Severity**: 🟡 Medium
- **File**: [server.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/server.js#L18)
- **Explanation**: `express.json({ limit: '50mb' })` is excessively high. Combined with Base64 file uploads, this could allow very large payloads.
- **Impact**: Memory exhaustion DoS attacks. A single request could consume 50MB of server memory.
- **Fix**: Reduce to a reasonable limit (e.g., 5MB) or implement proper file upload with streaming.

### SEC-010: No Input Validation on Signup
- **Severity**: 🟡 Medium
- **File**: [auth.js (routes)](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/routes/auth.js#L9-L14)
- **Explanation**: Signup only checks for field presence. No validation on email format, password strength, role validity, or input length.
- **Impact**: Weak passwords, invalid data, potential buffer issues with oversized inputs.
- **Fix**: Add input validation (email regex, password minimum length, role enum check, field length limits).

### SEC-011: SSL Certificate Validation Disabled
- **Severity**: 🟡 Medium
- **File**: [db.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/db.js#L8-L10)
- **Explanation**: `ssl: { rejectUnauthorized: false }` disables certificate validation, making the connection vulnerable to MITM attacks.
- **Impact**: An attacker on the network path could intercept database traffic.
- **Fix**: Use proper CA certificates for Neon, or make SSL config environment-dependent.

---

## 2. Bug Audit

### BUG-001: `test_db.js` Uses Supabase API Instead of pg
- **Severity**: 🟢 Low (dead code)
- **File**: [test_db.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/test_db.js#L1-L9)
- **Explanation**: This file imports `./db` but uses Supabase-style `.from().insert().select().single()` API. The project uses `pg`, not Supabase. This file would crash if run.
- **Impact**: None (dead code), but indicates incomplete migration from Supabase.
- **Fix**: Delete the file.

### BUG-002: Missing CSS Class `mb-8`
- **Severity**: 🟢 Low
- **File**: [index.html](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/index.html#L148)
- **Explanation**: HTML uses `class="flex mb-8 border-b border-border"` but `mb-8` is not defined in style.css. Also `border-b` and `border-border` are not defined.
- **Impact**: Missing margin-bottom on the tab container. No visual border.
- **Fix**: Add missing utility classes to style.css, or use inline styles.

### BUG-003: Duplicate Filter Params in Appointment Search
- **Severity**: 🟡 Medium
- **File**: [dashboard_user.html](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/dashboard_user.html#L329-L337)
- **Explanation**: If both date range and reason are filled, both `filter=date` and `filter=reason` are appended. The backend only reads the first `filter` value, so the behavior is unpredictable.
- **Impact**: Search results may be incorrect when both filters are set.
- **Fix**: Make filters mutually exclusive in the UI, or support combined filtering on the backend.

### BUG-004: Doctor Name Prefix Duplication
- **Severity**: 🟢 Low
- **File**: [dashboard_user.html](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/dashboard_user.html#L272)
- **Explanation**: Doctor cards render `Dr. ${d.name}`, but the seed data already stores names with "Dr." prefix (e.g., "Dr. Anil Sharma"). This produces "Dr. Dr. Anil Sharma".
- **Impact**: Visual duplication in doctor selection cards.
- **Fix**: Remove the "Dr." prefix from the template, or strip it from the data before rendering.

### BUG-005: `event` Implicit Global in `switchTab`
- **Severity**: 🟡 Medium
- **File**: [index.html](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/index.html#L233)
- **Explanation**: `event.target.classList.add('active')` uses the implicit global `event` object, which is non-standard and deprecated in most browsers. It also fails in strict mode.
- **Impact**: Tab switching may break in Firefox or strict mode environments.
- **Fix**: Pass `event` as a parameter from the onclick handler or use `addEventListener`.

### BUG-006: No Slot Conflict Check on Booking
- **Severity**: 🟡 Medium
- **File**: [appointments.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/routes/appointments.js#L89-L101)
- **Explanation**: The `/book` endpoint inserts directly without checking if the slot is still available. Race condition: two users could book the same slot simultaneously.
- **Impact**: Double-booking of the same time slot.
- **Fix**: Add a UNIQUE constraint on `(doctor_id, appointment_date, appointment_time)` or use a SELECT-then-INSERT with row locking.

### BUG-007: Doctor Today Shows ALL Non-Completed Appointments
- **Severity**: 🟡 Medium
- **File**: [doctor.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/routes/doctor.js#L20-L27)
- **Explanation**: Comment on line 29 admits: "Removed 'AND a.appointment_date = CURRENT_DATE' to make demo easier". This means the "Today's Appointments" view shows appointments from all dates.
- **Impact**: Misleading UI — heading says "Today's" but shows all pending appointments.
- **Fix**: Re-add date filter and rename to "Active Appointments" or provide a toggle.

---

## 3. Code Smells

### SMELL-001: 9 Debug/Test Files in Backend Root
- **Severity**: 🟡 Medium
- **Files**: `diagnose.js`, `debug_hash.js`, `debug_records.js`, `debug_records_full.js`, `debug_user.js`, `generate_hash.js`, `reset_pwd.js`, `test_cardio_login.js`, `test_doctor_signup.js`, `test_endpoint.js`, `test_medicine_expiry.js`
- **Explanation**: Development debugging scripts committed to production. Some contain hardcoded credentials and personal emails.
- **Impact**: Clutters the codebase, exposes development patterns.
- **Fix**: Delete all debug/test files or move to a `scripts/debug/` directory with gitignore.

### SMELL-002: Dead Data File
- **Severity**: 🟢 Low
- **File**: [store.json](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/data/store.json)
- **Explanation**: Flat-file data store from an earlier design. Never imported or used by any code.
- **Impact**: Confusing for new developers.
- **Fix**: Delete `backend/data/` directory.

### SMELL-003: Massive Inline Scripts
- **Severity**: 🟠 High
- **Files**: `dashboard_user.html` (~230 lines of inline JS), `dashboard_doctor.html` (~180 lines), `index.html` (~60 lines)
- **Explanation**: All page-specific JavaScript is embedded in `<script>` tags within HTML files. No separation of concerns.
- **Impact**: Untestable, unmaintainable, no code reuse, no IDE support for JS inside HTML.
- **Fix**: Extract to separate JS files (`dashboard_user.js`, `dashboard_doctor.js`, `index_page.js`).

### SMELL-004: Inline Styles Throughout HTML
- **Severity**: 🟡 Medium
- **Files**: All 3 HTML files
- **Explanation**: Extensive use of `style="..."` attributes for layout, spacing, sizing, and colors. ~50+ inline style declarations.
- **Impact**: Inconsistent styling, impossible to maintain a design system, overrides cascade.
- **Fix**: Move to CSS classes. Define proper utility classes or component-level styles.

### SMELL-005: Inline `<style>` Blocks in HTML
- **Severity**: 🟡 Medium
- **Files**: All 3 HTML files
- **Explanation**: Each HTML file has a `<style>` block (60-80 lines) defining page-specific CSS. These overlap with and sometimes conflict with `style.css`.
- **Impact**: Duplicate `.modal` styles in `dashboard_doctor.html` and `style.css`. Hard to track which styles apply where.
- **Fix**: Consolidate all CSS into `style.css` or create page-specific CSS files.

### SMELL-006: `dotenv.config()` Called in Multiple Files
- **Severity**: 🟢 Low
- **Files**: `server.js`, `db.js`, `middleware/auth.js`, `routes/auth.js`
- **Explanation**: Four files independently call `require('dotenv').config()`. The path argument is inconsistent — some specify `backend/.env`, others use default.
- **Impact**: Confusion about where env vars are loaded. Redundant operations.
- **Fix**: Load dotenv once in `server.js` before any other imports.

### SMELL-007: Repeated Error Handling Pattern
- **Severity**: 🟡 Medium
- **Files**: All route files
- **Explanation**: Every route handler has the same try/catch pattern:
  ```js
  catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
  }
  ```
  This is repeated ~15 times.
- **Impact**: Boilerplate code, inconsistent error responses (some include `code`, some don't).
- **Fix**: Create an async error handler wrapper function or use Express error middleware.

### SMELL-008: Undocumented Magic Number in Slot Generation
- **Severity**: 🟢 Low
- **File**: [appointments.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/routes/appointments.js#L70-L80)
- **Explanation**: Slots are generated from `9` to `17` (9 AM to 5 PM) with 30-minute intervals. These are hardcoded magic numbers.
- **Impact**: Hard to configure working hours per doctor (even though `availability_start/end` exists in the Doctors table).
- **Fix**: Read availability from the Doctors table. Define constants for defaults.

### SMELL-009: Tailwind-Like CSS Class Names
- **Severity**: 🟢 Low
- **File**: [style.css](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/css/style.css), HTML files
- **Explanation**: Classes like `flex`, `gap-2`, `mb-4`, `text-sm`, `w-full`, `grid-cols-2` mimic Tailwind CSS naming — but it's handwritten vanilla CSS with only a small subset of utilities defined.
- **Impact**: Developers may expect Tailwind behavior. Many classes used in HTML (like `mb-8`, `border-b`, `border-border`, `pl-4`, `py-3`, `px-2`, `tracking-wider`, `font-mono`, `italic`) are never defined and thus do nothing.
- **Fix**: Define all used utility classes or switch to a consistent naming convention.

### SMELL-010: Global Window Function Assignments
- **Severity**: 🟡 Medium
- **Files**: `dashboard_user.html`, `dashboard_doctor.html`
- **Explanation**: Functions are attached to `window` object (`window.selectDept`, `window.selectDoctor`, `window.addMedRow`, etc.) to make them accessible from `onclick` handlers in HTML.
- **Impact**: Global namespace pollution, no encapsulation.
- **Fix**: Use event delegation or `addEventListener` instead of inline `onclick` handlers.

---

## 4. Performance Audit

### PERF-001: Base64 File Storage in Database
- **Severity**: 🟠 High
- **File**: [doctor.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/routes/doctor.js#L77-L78), [dashboard_doctor.html](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/dashboard_doctor.html#L264-L271)
- **Explanation**: Reports are converted to Base64 on the client and stored as TEXT in the `attached_reports` column. A 2MB file becomes ~2.67MB of Base64 text in the database.
- **Impact**: Database bloat, slow queries when records are fetched, excessive memory usage, 50MB JSON body limit.
- **Fix**: Use file storage (S3, Cloudinary, Vercel Blob) and store URLs in the database.

### PERF-002: No Database Indexes
- **Severity**: 🟡 Medium
- **File**: [schema.sql](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/schema.sql)
- **Explanation**: No indexes beyond auto-created primary key and unique constraint indexes. Common query patterns (`WHERE patient_id = ?`, `WHERE doctor_id = ? AND appointment_date = ?`, `WHERE email = ?`) lack indexes.
- **Impact**: Full table scans as data grows. Currently acceptable with small dataset.
- **Fix**: Add indexes on `Appointments(patient_id)`, `Appointments(doctor_id, appointment_date)`, `Doctors(user_id)`, `MedicalRecords(appointment_id)`.

### PERF-003: N+1-Like Query in Doctor Record Submission
- **Severity**: 🟡 Medium
- **File**: [doctor.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/routes/doctor.js#L84-L89)
- **Explanation**: Prescriptions are inserted one at a time in a loop. For 5 medications, this is 5 separate INSERT queries.
- **Impact**: Multiple round-trips to DB. Slow under load.
- **Fix**: Use a single multi-row INSERT statement or batch insert.

### PERF-004: Oversized Logo Image
- **Severity**: 🟡 Medium
- **File**: `frontend/img/logo.png` (411 KB)
- **Explanation**: A 411 KB PNG logo displayed at 40-60px height. Most logos at this size should be <20 KB.
- **Impact**: Slow initial page load, wasted bandwidth on every page (loaded 3 times across 3 HTML files).
- **Fix**: Optimize/compress the image or convert to SVG. Add proper dimensions.

### PERF-005: Unminified CSS/JS
- **Severity**: 🟢 Low
- **Explanation**: No build process — CSS and JS are served raw.
- **Impact**: Larger file transfers. Minimal impact at current scale (~5KB CSS, ~2KB JS).
- **Fix**: Consider a build step for production, or accept for simplicity.

### PERF-006: Google Fonts Loaded on Every Page
- **Severity**: 🟢 Low
- **Files**: All 3 HTML files
- **Explanation**: Each page has its own `<link>` to Google Fonts CDN. No preload or font-display strategy.
- **Impact**: Flash of unstyled text (FOUT), render-blocking request.
- **Fix**: Add `font-display: swap` and consider preloading.

---

## 5. Accessibility Audit

### A11Y-001: No Keyboard Navigation Support
- **Severity**: 🟠 High
- **Files**: All HTML files
- **Explanation**: Interactive elements like department cards, time slots, and role selectors are `<div>` elements with `onclick` handlers. They have no `tabindex`, `role`, or keyboard event handlers.
- **Impact**: Users who rely on keyboard navigation (or screen readers) cannot interact with core features.
- **Fix**: Use `<button>` elements or add `role="button"`, `tabindex="0"`, and `keydown` handlers.

### A11Y-002: No Focus Indicators
- **Severity**: 🟡 Medium
- **Files**: CSS files
- **Explanation**: No custom focus styles defined. Browser defaults may be overridden by the dark theme.
- **Impact**: Keyboard users cannot see which element is focused.
- **Fix**: Add visible focus indicators (`outline`, `box-shadow`) on all interactive elements.

### A11Y-003: Low Contrast Text
- **Severity**: 🟡 Medium
- **File**: [style.css](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/css/style.css#L5)
- **Explanation**: `--text-muted: #888888` on `--bg-dark: #050505` gives a contrast ratio of ~5.6:1 for normal text. Some smaller text (`text-xs`, `text-sm`) may fall below WCAG AA requirements (4.5:1 for normal, 3:1 for large).
- **Impact**: Difficult to read for users with vision impairments.
- **Fix**: Increase muted text color to at least `#999999` or `#a0a0a0` for body text.

### A11Y-004: No Semantic HTML for Navigation
- **Severity**: 🟡 Medium
- **Files**: Dashboard HTML files
- **Explanation**: Sidebar navigation uses `<div>` and `<a>` tags without `<nav>`, `<main>`, or ARIA roles. Top navigation uses `<nav>` but sidebar doesn't.
- **Impact**: Screen readers cannot identify the sidebar as navigation.
- **Fix**: Wrap sidebar in `<nav aria-label="Dashboard navigation">` and main content in `<main>`.

### A11Y-005: Form Labels Not Properly Associated
- **Severity**: 🟡 Medium
- **Files**: Dashboard HTML files
- **Explanation**: Labels use `class="block"` styling but many lack `for` attributes linking them to their inputs.
- **Impact**: Clicking a label doesn't focus its input. Screen readers may not announce the label correctly.
- **Fix**: Add `for="input-id"` to all labels and ensure inputs have matching `id` attributes.

### A11Y-006: Images Missing Alt Text
- **Severity**: 🟡 Medium
- **Files**: [index.html](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/index.html#L128) (`alt=""`), [dashboard_user.html](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/dashboard_user.html#L94) (`alt="Logo"`)
- **Explanation**: The logo on the index page has an empty alt text (`alt=""`), while on dashboards it says "Logo" — neither is descriptive.
- **Impact**: Screen readers skip or misidentify the image.
- **Fix**: Use `alt="KAPS MedTech logo"` consistently.

### A11Y-007: No Skip Navigation Link
- **Severity**: 🟢 Low
- **Files**: All HTML files
- **Explanation**: No "Skip to main content" link for keyboard users to bypass navigation.
- **Impact**: Keyboard users must tab through all navigation items on every page load.
- **Fix**: Add a visually hidden skip link as the first focusable element.

### A11Y-008: `alert()` for User Feedback
- **Severity**: 🟡 Medium
- **Files**: All HTML files, [app.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/js/app.js#L50)
- **Explanation**: All user feedback uses browser `alert()` and `confirm()` dialogs.
- **Impact**: Disruptive UX, not customizable, blocks the main thread, poor accessibility.
- **Fix**: Implement toast notifications or inline feedback messages.

---

## 6. Responsiveness Audit

### RESP-001: Split Layout Breaks on Mobile
- **Severity**: 🟠 High
- **File**: [index.html](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/index.html#L21-L46)
- **Explanation**: Login page uses `display: flex` with `flex: 1` and `flex: 0.8` for a side-by-side layout. No media queries. On mobile, both panels squeeze together.
- **Impact**: Login form is unusable on mobile devices.
- **Fix**: Add media queries to stack layout vertically on screens < 768px.

### RESP-002: Dashboard Sidebar Not Responsive
- **Severity**: 🟠 High
- **File**: [dashboard_user.html](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/dashboard_user.html#L107)
- **Explanation**: Sidebar has a fixed `width: 250px`. On mobile, it consumes too much horizontal space.
- **Impact**: Main content area is too narrow on mobile devices.
- **Fix**: Collapse sidebar to a hamburger menu or bottom tab bar on mobile.

### RESP-003: No Media Queries Anywhere
- **Severity**: 🟠 High
- **File**: [style.css](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/css/style.css)
- **Explanation**: Zero `@media` queries in the entire CSS file. No responsive breakpoints.
- **Impact**: The application is desktop-only in practice.
- **Fix**: Add responsive breakpoints for mobile (< 640px), tablet (< 1024px).

### RESP-004: Doctor Dashboard 2-Column Grid in Modal
- **Severity**: 🟡 Medium
- **File**: [dashboard_doctor.html](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/dashboard_doctor.html#L67)
- **Explanation**: Treatment modal uses `grid-cols-2` for patient info + treatment form. On smaller screens, this creates very narrow columns.
- **Impact**: Treatment form is cramped on tablets and smaller desktops.
- **Fix**: Stack to single column on screens < 768px.

---

## 7. Code Quality Summary

### Dead Code Inventory
| File | Type | Should Be |
|------|------|-----------|
| `backend/diagnose.js` | Debug utility | Deleted |
| `backend/debug_hash.js` | Debug utility | Deleted |
| `backend/debug_records.js` | Debug utility | Deleted |
| `backend/debug_records_full.js` | Debug utility | Deleted |
| `backend/debug_user.js` | Debug utility | Deleted |
| `backend/generate_hash.js` | Debug utility | Deleted |
| `backend/reset_pwd.js` | Debug utility (contains personal email) | Deleted |
| `backend/test_cardio_login.js` | Test script | Deleted |
| `backend/test_db.js` | Broken test (Supabase API) | Deleted |
| `backend/test_doctor_signup.js` | Test script | Deleted |
| `backend/test_endpoint.js` | Test script | Deleted |
| `backend/test_medicine_expiry.js` | Test script | Deleted |
| `backend/data/store.json` | Legacy flat-file store | Deleted |

### Undefined CSS Classes Used in HTML
| Class | Used In | Defined? |
|-------|---------|----------|
| `mb-8` | index.html | ❌ |
| `border-b` | index.html | ❌ |
| `border-border` | index.html | ❌ |
| `pl-4` | dashboard_user.html | ❌ |
| `py-3` | dashboard_doctor.html | ❌ |
| `px-2` | dashboard_doctor.html | ❌ |
| `py-0.5` | dashboard_doctor.html | ❌ |
| `p-3` / `p-4` / `p-6` / `p-8` | dashboard_doctor.html | ❌ |
| `tracking-wider` / `tracking-wide` | dashboard_doctor.html | ❌ |
| `font-mono` | dashboard_doctor.html | ❌ |
| `font-bold` / `font-semibold` | dashboard_user/doctor.html | ❌ |
| `italic` | dashboard_user.html | ❌ |
| `block` | multiple | ❌ |
| `uppercase` | dashboard_doctor.html | ❌ |
| `relative` | dashboard_user.html | ❌ |
| `cursor-pointer` | dashboard_user.html | ❌ |
| `col-span-2` | dashboard_user.html | ❌ |
| `bg-dark` | dashboard_doctor.html | ❌ |
| `rounded` / `rounded-lg` | dashboard_doctor.html | ❌ |
| `transition` / `duration-200` | dashboard_doctor.html | ❌ |
| `shadow-lg` | dashboard_doctor.html | ❌ |
| `text-danger` / `border-danger` | dashboard_doctor.html | ❌ |
| `hover:*` classes | multiple | ❌ (Not Tailwind) |
| `min-w-[80px]` | dashboard_doctor.html | ❌ (Tailwind arbitrary) |
| `grid-cols-1` | dashboard_doctor.html | ❌ |
| `mt-1` | dashboard_user.html | ❌ |
| `custom-scroll` | dashboard_doctor.html | ❌ |
| `border-dashed` / `border-gray-700` | dashboard_doctor.html | ❌ |
| `text-accent` | dashboard_doctor.html | ❌ |

> **~30+ CSS classes used in HTML that have no corresponding definition.** This is one of the most pervasive issues — the HTML was written assuming a Tailwind-like framework, but only ~25 utility classes are actually defined.

---

## 8. Issue Count Summary

| Category | 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | Total |
|----------|:-----------:|:-------:|:---------:|:------:|:-----:|
| Security | 2 | 4 | 5 | 0 | 11 |
| Bugs | 0 | 0 | 4 | 3 | 7 |
| Code Smells | 0 | 2 | 5 | 3 | 10 |
| Performance | 0 | 1 | 3 | 2 | 6 |
| Accessibility | 0 | 1 | 5 | 2 | 8 |
| Responsiveness | 0 | 3 | 1 | 0 | 4 |
| **Total** | **2** | **11** | **23** | **10** | **46** |
