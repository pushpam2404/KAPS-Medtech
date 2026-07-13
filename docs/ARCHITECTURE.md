# KAPS MedTech — System Architecture

This document describes the architectural layout, component interactions, security model, and structural organization of the **KAPS MedTech** application.

---

## 1. Architectural Overview

KAPS MedTech is built on a decoupled full-stack model served from a single Node.js runtime. 

```
               [ Client Side ]                 |             [ Server Side ]
                                               |
  +-----------------------------------------+  |  +------------------------------------+
  |              Web Browser                |  |  |           Express Engine           |
  |                                         |  |  |                                    |
  |  +-----------------------------------+  |  |  |  +------------------------------+  |
  |  |            HTML / CSS             |  |  |  |  |     Rate Limiter Middleware    |  |
  |  +-----------------------------------+  |  |  |  +---------------+--------------+  |
  |                      |                  |  |  |                  |                 |
  |  +-------------------+---------------+  |  |  |  +---------------+--------------+  |
  |  |           Vanilla JS              |  |  |  |  |     Authentication Guard     |  |
  |  |    (dashboard_user, app, login)   |  |  |  |  +---------------+--------------+  |
  |  +-------------------+---------------+  |  |  |                  |                 |
  +----------------------|------------------+  |  |  +---------------+--------------+  |
                         |                     |  |  |          Router Groups         |  |
                         | (Fetch API / JSON)  |  |  |     (auth, appts, doctor)    |  |
                         +----------------------> |  +---------------+--------------+  |
                                               |  |                  |                 |
                                               |  |  +---------------+--------------+  |
                                               |  |  |   Centralized Error Handler  |  |
                                               |  |  +---------------+--------------+  |
                                               |  +------------------|-----------------+
                                               |                     | (Pool / SSL)
                                               |                     v
                                               |  +------------------------------------+
                                               |  |             PostgreSQL             |
                                               |  |          (Neon Serverless)         |
                                               |  +------------------------------------+
```

The system separates concerns across three key modules:
- **Presentation Layer (Frontend)**: Standard semantic HTML, unified dark theme variables, page-specific modules extracted to clean JS files.
- **Service Layer (Backend)**: Express API routes parsing parameters, enforcing rate limits, parsing JSON payloads up to 5MB, checking resource scopes, and delegating DB actions.
- **Data Persistence Layer (Database)**: Postgres tables carrying triggers, unique index constraints, and cascading rules.

---

## 2. Frontend Structure & Design Tokens

The frontend uses raw, compilation-free resources for immediate browser execution, styled with a modernized dark theme design system in `frontend/css/style.css`.

### UI Design Tokens
- **Core Dark Tone**: `#090a0f` (rich deep indigo-black)
- **Primary Accent**: `#00cec9` (clinical bright turquoise)
- **Secondary Tone**: `#3b82f6` (trustworthy slate-blue)
- **Card Background**: `#12141c` (sleek elevation)
- **Border Guidelines**: `#222533` (subtle separating strokes)

### Javascript Organization
- [app.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/js/app.js): Stores local variables (`token`, `role`, `user`), exposes a standardized wrapper for `fetch` api calls, validates 401/403 unauthorized tokens, handles session clearing on logout.
- [login.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/js/login.js): Handles Tab switching, Role card selection, forms validation, and loading indicators for the welcome page.
- [dashboard_user.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/js/dashboard_user.js): Handles symptom collection, step-by-step booking steps, appointments filtration, records preview modal, active medicine calculations, and reminders.
- [dashboard_doctor.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/frontend/js/dashboard_doctor.js): Handles daily appointments queuing, visit history parsing, clinical reports upload, and multi-row prescription records submission.

---

## 3. Backend Routes and Core Middleware

The backend application is orchestrated in [server.js](file:///Users/pushpam/Desktop/kaps/KAPS_MedTech/backend/server.js):

```
  Request --> [CORS Handler] --> [Rate Limiter] --> [JSON parser (5MB)] --> [Routes] --> [DB Pool]
                                                                                |
                                                                       Exception (Pass to Next)
                                                                                |
                                                                                v
                                                                    [ErrorHandler Middleware]
```

### Core Middlewares
- **auth.js (authenticateToken)**: Verifies the JWT Bearer token inside the `Authorization` header. Decodes token payloads to bind `{ id, role, name }` to the `req.user` context.
- **rateLimiter.js (rateLimiter)**: Uses an IP-based Map registry tracking timestamp limits. Restricts auth actions (signup/login) to prevent credential stuffing.
- **errorHandler.js (errorHandler)**: Captures database constraints, routing errors, and custom exceptions. Prevents SQL error code leakage by mapping server exceptions to generic responses while dumping stack frames inside local debug logs.

---

## 4. Security Architecture

- **Context Isolation**: No direct database client calls from Javascript. Database is fully shielded behind Express routers.
- **JWT Authorization**: Encrypted payloads carrying expiration thresholds. Falling back to default keys is blocked by startup assertion script.
- **SQL Injection Prevention**: Parameterized queries using positional variables (`$1`, `$2`) sanitize input inputs.
- **Cross-site Scripting (XSS)**: Input validation restricts raw script payloads from being saved to the database. Text content is rendered using secure browser nodes (`textContent`, `innerText`) rather than insecure templates.
