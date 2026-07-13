# KAPS MedTech — Implementation Plan

> **Phase 3: Engineering Roadmap**
> Generated: 2026-07-13
> Based on: [PROJECT_ANALYSIS.md](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/docs/PROJECT_ANALYSIS.md) and [CODE_AUDIT.md](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/docs/CODE_AUDIT.md)

---

## Prioritization Framework

Tasks are organized by criticality and ordered to build upon each other. Dependencies are noted.

---

## 🔴 Critical Priority

> These issues represent active vulnerabilities or data integrity risks. Must be fixed first.

### C1. Fix JWT Secret Fallback (SEC-001)
- **Audit Ref**: SEC-001
- **Effort**: 15 min
- **Impact**: Eliminates authentication bypass vector
- **Why**: An attacker who discovers the fallback `'secret'` can forge any user's JWT token
- **Action**:
  - Remove `|| 'secret'` fallback in `routes/auth.js`
  - Add startup validation in `server.js` that exits if `JWT_SECRET` is not set
- **Files**: `backend/routes/auth.js`, `backend/server.js`

### C2. Add Authorization Checks on Record/Reschedule Endpoints (SEC-002)
- **Audit Ref**: SEC-002
- **Effort**: 30 min
- **Impact**: Prevents unauthorized access to medical records
- **Why**: Any authenticated user can currently read any patient's medical data by guessing appointment IDs
- **Action**:
  - `GET /:id/record`: Verify `patient_id = req.user.id` (or allow doctor who owns the appointment)
  - `PUT /:id/reschedule`: Verify `patient_id = req.user.id`
- **Files**: `backend/routes/appointments.js`

### C3. Add Doctor Ownership Check on Cancel (SEC-003)
- **Audit Ref**: SEC-003
- **Effort**: 15 min
- **Impact**: Prevents doctors from cancelling other doctors' appointments
- **Action**: Join Appointments with Doctors to verify doctor_id matches the requesting doctor
- **Files**: `backend/routes/doctor.js`

---

## 🟠 High Priority

> Significant security, quality, and UX issues that should be addressed immediately after critical items.

### H1. Stop Exposing Internal Errors to Client (SEC-004)
- **Audit Ref**: SEC-004, SMELL-007
- **Effort**: 1 hour
- **Impact**: Information disclosure prevention + DRY error handling
- **Why**: Error messages currently leak PostgreSQL internals (table names, constraints, error codes)
- **Action**:
  - Create centralized error handling middleware
  - Create async route handler wrapper
  - Return generic messages to client, log details server-side
- **Files**: `backend/middleware/errorHandler.js` (NEW), all route files

### H2. Add Input Validation (SEC-010)
- **Audit Ref**: SEC-010
- **Effort**: 1.5 hours
- **Impact**: Prevents invalid data, XSS payloads, and edge-case bugs
- **Why**: No validation beyond basic field presence checks
- **Action**:
  - Validate email format, password length, role enum on signup
  - Validate date format, time format, integer IDs on booking
  - Sanitize text inputs
- **Files**: `backend/routes/auth.js`, `backend/routes/appointments.js`, `backend/routes/doctor.js`

### H3. Configure CORS Properly (SEC-005)
- **Audit Ref**: SEC-005
- **Effort**: 15 min
- **Impact**: Restricts cross-origin access to approved domains
- **Action**: Configure `cors()` with allowed origins from environment variable
- **Files**: `backend/server.js`

### H4. Add Race Condition Protection on Booking (BUG-006)
- **Audit Ref**: BUG-006
- **Effort**: 30 min
- **Impact**: Prevents double-booking
- **Action**: Add unique constraint `(doctor_id, appointment_date, appointment_time)` where status != 'Cancelled'. Use INSERT with conflict detection.
- **Files**: `backend/schema.sql`, `backend/routes/appointments.js`

### H5. Remove Dead Code (SMELL-001, SMELL-002, BUG-001)
- **Audit Ref**: SMELL-001, SMELL-002, BUG-001
- **Effort**: 15 min
- **Impact**: Removes 12 unnecessary files, cleans project structure
- **Why**: Debug scripts contain personal emails and hardcoded credentials
- **Action**:
  - Delete all `debug_*.js`, `test_*.js`, `generate_hash.js`, `reset_pwd.js`, `diagnose.js`
  - Delete `backend/data/store.json` (and directory)
- **Files**: 13 files to delete

### H6. Extract Inline JavaScript to Separate Files (SMELL-003)
- **Audit Ref**: SMELL-003
- **Effort**: 2 hours
- **Impact**: Testable, maintainable, and cacheable JavaScript
- **Why**: ~470 lines of inline JS across 3 HTML files makes the code untestable and unmaintainable
- **Action**:
  - Create `frontend/js/login.js` for index.html logic
  - Create `frontend/js/dashboard_user.js` for user dashboard logic
  - Create `frontend/js/dashboard_doctor.js` for doctor dashboard logic
  - Replace inline `<script>` blocks with `<script src="">` references
- **Files**: 3 new JS files, 3 HTML files modified

### H7. Fix All Undefined CSS Classes (SMELL-009, BUG-002)
- **Audit Ref**: SMELL-009, BUG-002
- **Effort**: 2 hours
- **Impact**: All styling actually works as intended
- **Why**: 30+ CSS classes used in HTML have no corresponding definition — layout and typography are silently broken
- **Action**:
  - Define all missing utility classes in `style.css`
  - Alternatively, replace with properly defined classes
  - Consolidate inline `<style>` blocks from HTML files into the CSS file
- **Files**: `frontend/css/style.css`, all HTML files

### H8. Add Responsive Design (RESP-001, RESP-002, RESP-003, RESP-004)
- **Audit Ref**: RESP-001 through RESP-004
- **Effort**: 3 hours
- **Impact**: Application works on mobile and tablet devices
- **Why**: Zero media queries — completely unusable on mobile
- **Action**:
  - Add breakpoints: mobile (<640px), tablet (<1024px)
  - Stack login layout on mobile
  - Convert sidebar to bottom tabs or hamburger on mobile
  - Stack modal grid to single column on small screens
  - Ensure department grid and doctor cards reflow properly
- **Files**: `frontend/css/style.css`, HTML files as needed

### H9. Frontend Modernization — Professional Healthcare UI
- **Effort**: 4 hours
- **Impact**: Enterprise-grade visual quality suitable for healthcare software
- **Why**: Current UI has the right foundation (dark theme, design tokens) but needs polish for a professional context
- **Action**:
  - Refine color palette for healthcare context (trustworthy blues/greens)
  - Add proper loading/skeleton states (not "Loading..." text)
  - Add empty state illustrations/messages
  - Replace `alert()` with toast notification system
  - Add smooth transitions and micro-animations
  - Improve form design with proper spacing and validation indicators
  - Add card hover effects, button ripple effects
  - Design proper table/list components for data display
  - Create consistent spacing scale
  - Add a favicon
- **Files**: `frontend/css/style.css`, all HTML files, new JS components

---

## 🟡 Medium Priority

> Important improvements for maintainability, performance, and quality. Not urgent but meaningful.

### M1. Add Database Indexes (PERF-002)
- **Effort**: 20 min
- **Impact**: Query performance as data grows
- **Action**: Add indexes on frequently queried columns
  ```sql
  CREATE INDEX idx_appointments_patient ON Appointments(patient_id);
  CREATE INDEX idx_appointments_doctor_date ON Appointments(doctor_id, appointment_date);
  CREATE INDEX idx_doctors_user ON Doctors(user_id);
  CREATE INDEX idx_medical_records_appointment ON MedicalRecords(appointment_id);
  CREATE INDEX idx_prescriptions_record ON Prescriptions(record_id);
  ```
- **Files**: `backend/schema.sql`

### M2. Consolidate dotenv Loading (SMELL-006)
- **Effort**: 15 min
- **Impact**: Single source of truth for environment configuration
- **Action**: Remove `require('dotenv').config()` from `db.js`, `middleware/auth.js`, `routes/auth.js`. Keep only in `server.js`.
- **Files**: 4 backend files

### M3. Batch Prescription Inserts (PERF-003)
- **Effort**: 30 min
- **Impact**: Reduces DB round-trips from N to 1
- **Action**: Replace loop INSERT with single multi-row INSERT using `VALUES` concatenation
- **Files**: `backend/routes/doctor.js`

### M4. Fix Doctor Name Duplication (BUG-004)
- **Effort**: 10 min
- **Impact**: Correct display of doctor names
- **Action**: Remove "Dr." prefix from template strings since seed data already includes it
- **Files**: `frontend/dashboard_user.html` (or extracted JS)

### M5. Fix Duplicate Filter Bug (BUG-003)
- **Effort**: 20 min
- **Impact**: Correct search behavior when both filters are set
- **Action**: Make date and reason filters mutually exclusive in the UI, clear the other when one is used
- **Files**: Frontend JS for user dashboard

### M6. Reduce JSON Body Limit (SEC-009)
- **Effort**: 5 min
- **Impact**: Reduces memory exhaustion risk
- **Action**: Change `{ limit: '50mb' }` to `{ limit: '5mb' }`
- **Files**: `backend/server.js`

### M7. Accessibility Improvements (A11Y-001 through A11Y-008)
- **Effort**: 2 hours
- **Impact**: Usable by keyboard and screen reader users
- **Action**:
  - Replace div-buttons with `<button>` elements
  - Add `tabindex`, `role`, and keyboard handlers where needed
  - Add focus indicators in CSS
  - Add proper `for`/`id` label associations
  - Add `alt` text for logo
  - Add `<main>`, `<nav>` semantic elements
  - Add skip navigation link
- **Files**: All HTML files, `frontend/css/style.css`

### M8. Fix Doctor Today Query (BUG-007)
- **Effort**: 15 min
- **Impact**: Correct "Today's Appointments" display
- **Action**: Rename to "Active Appointments" and keep the current behavior, or re-add date filter with a date picker
- **Files**: `backend/routes/doctor.js`, `frontend/dashboard_doctor.html`

### M9. Optimize Logo Image (PERF-004)
- **Effort**: 15 min
- **Impact**: Faster page loads
- **Action**: Compress the 411KB PNG or convert to optimized SVG/WebP
- **Files**: `frontend/img/logo.png`

### M10. Add Structured Logging
- **Effort**: 30 min
- **Impact**: Debuggability in production
- **Action**: Replace `console.error` with a lightweight logger (e.g., structured JSON logging for Vercel)
- **Files**: All backend files

---

## 🟢 Low Priority

> Nice-to-have improvements. Can be done after higher priorities.

### L1. Fix Implicit `event` Global (BUG-005)
- **Effort**: 10 min
- **Impact**: Cross-browser compatibility
- **Action**: Pass `event` parameter in onclick or use addEventListener
- **Files**: `frontend/index.html` (or extracted JS)

### L2. Use Doctor Availability for Slot Generation (SMELL-008)
- **Effort**: 30 min
- **Impact**: Accurate slots based on doctor schedule
- **Action**: Query `availability_start/end` from Doctors table instead of hardcoding 9-17
- **Files**: `backend/routes/appointments.js`

### L3. Add Font Display Strategy (PERF-006)
- **Effort**: 10 min
- **Impact**: Faster perceived page load
- **Action**: Add `&display=swap` to Google Fonts URL, add preload hint
- **Files**: All HTML files

### L4. Add Rate Limiting (SEC-006)
- **Effort**: 30 min
- **Impact**: Brute-force protection
- **Action**: Add `express-rate-limit` with strict limits on auth endpoints
- **Files**: `backend/server.js` (new dependency)

### L5. SSL Configuration Improvement (SEC-011)
- **Effort**: 15 min
- **Impact**: Proper TLS handling for database connections
- **Action**: Make SSL configuration environment-dependent
- **Files**: `backend/db.js`

---

## Effort Summary

| Priority | Tasks | Estimated Total Effort |
|----------|-------|----------------------|
| 🔴 Critical | 3 | ~1 hour |
| 🟠 High | 9 | ~14 hours |
| 🟡 Medium | 10 | ~4 hours |
| 🟢 Low | 5 | ~1.5 hours |
| **Total** | **27** | **~20.5 hours** |

---

## Execution Order

The implementation should follow this dependency-aware order:

```
Phase A: Security Fixes (No UI changes)
├── C1: JWT Secret Fallback
├── C2: Authorization on Records
├── C3: Doctor Cancel Auth
├── H1: Error Handling Middleware
├── H2: Input Validation
├── H3: CORS Configuration
├── H4: Booking Race Condition
└── M6: JSON Body Limit

Phase B: Code Cleanup
├── H5: Remove Dead Code
├── M2: Consolidate dotenv
├── M3: Batch Inserts
├── M1: Database Indexes
└── M10: Structured Logging

Phase C: Frontend Restructuring
├── H6: Extract Inline JS
├── H7: Fix Undefined CSS Classes
├── M4: Fix Doctor Name Duplication
├── M5: Fix Duplicate Filter Bug
└── L1: Fix Event Global

Phase D: Frontend Modernization
├── H8: Responsive Design
├── H9: Professional UI Polish
├── M7: Accessibility
├── M9: Logo Optimization
└── L3: Font Display

Phase E: Remaining Items
├── M8: Doctor Today Query
├── L2: Doctor Availability Slots
├── L4: Rate Limiting
└── L5: SSL Config

Phase F: Documentation
├── Generate all docs/ files
└── Update README
```

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Breaking login flow | Test login/signup immediately after JWT changes |
| Breaking booking flow | Test full booking wizard after CSS changes |
| Breaking doctor treatment flow | Test treatment modal after JS extraction |
| CSS regressions from class fixes | Visual comparison before/after |
| Data loss from schema changes | Indexes are additive (CREATE INDEX), no DROP operations |

---

## ⏸️ STOP — Awaiting Approval

The above plan is ready for review. No code changes will be made until you approve.

**Please review and:**
1. Approve the plan as-is, OR
2. Request modifications to scope, priority, or approach
