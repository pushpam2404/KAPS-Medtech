# KAPS MedTech — Developer Guide

This guide is intended for engineers contributing to the **KAPS MedTech** codebase. It outlines development standards, route architectures, styling guidelines, and patterns to maintain.

---

## 1. Development Standards

### Naming Conventions
- **JavaScript Variables & Functions**: `camelCase` (e.g. `bookingTime`, `selectRole`).
- **CSS Classes**: `kebab-case` (e.g. `status-badge`, `btn-primary`).
- **Database Tables & Columns**: PascalCase for tables (`Users`, `Appointments`) and snake_case for columns (`password_hash`, `appointment_time`).

### Directory Layout
- **All backend logic** lives in `backend/`:
  - `routes/`: Business logic divided by entity (auth, appointments, doctor).
  - `middleware/`: Reusable guards (JWT verification, rate limiter).
- **All frontend pages & assets** live in `frontend/`:
  - `css/`: Theme files and style utilities.
  - `js/`: Extracted script modules (`login.js`, `dashboard_user.js`, `dashboard_doctor.js`).

---

## 2. Coding Patterns

### Backend Async Handlers
To prevent server crashes, use the `asyncHandler` wrapper on all Express routes. It catches exceptions and forwards them to the central error middleware:

```javascript
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/my-route', asyncHandler(async (req, res) => {
    const result = await db.query('SELECT * FROM MyTable');
    res.json(result.rows);
}));
```

### Database Parameterization
Never insert user input directly into SQL strings. Always use parameterized positional values to protect against SQL injections:

```javascript
// CORRECT
const query = 'SELECT * FROM Users WHERE id = $1';
const result = await db.query(query, [userId]);

// INCORRECT
const query = `SELECT * FROM Users WHERE id = ${userId}`;
```

---

## 3. UI/UX and Styles Guide

We use a consolidated, single-source theme file at `frontend/css/style.css`.
- **Responsive Layouts**: Design with desktop and mobile in mind. Stack navigation, tables, and buttons on screens below `768px` using defined breakpoints.
- **Accessibility**:
  - Always use interactive elements (like `<button>`) for clickable actions. Avoid using `div` with `onclick` because screen readers cannot focus on them.
  - Interactive components must have explicit focus states.
  - Ensure form labels have the correct `for` attributes linking them to input fields.
- **Micro-interactions**: Use transitions (`transition: var(--transition-fast)`) to animate button hover states, card selections, and modal visibility changes.
- **Toast Notifications**: Reusable notification alerts (`showToast(message, type)`) should be used for user alerts instead of blocking browser popups (`alert()`).

---

## 4. Contributing Checklist

Before submitting changes, make sure you complete this checklist:
- [ ] No hardcoded passwords, emails, or fallback secrets in source code files.
- [ ] Centralized error handlers are used instead of exposing database exception parameters in client payloads.
- [ ] No inline scripts are left inside HTML files.
- [ ] The app layout looks clean and behaves responsively on mobile views (<768px).
- [ ] All database script updates (like indices or schemas) are documented in `schema.sql`.
- [ ] The Vercel health check endpoint (`GET /api/health`) passes successfully.
