# KAPS MedTech — Project Analysis

> **Phase 1: Repository Discovery**
> Generated: 2026-07-13
> Analyst: AI Engineering Team

---

## 1. Project Overview

**KAPS MedTech** is a university healthcare management system that connects students and staff with on-campus doctors. It was built during a hackathon ("KAPS Hackathon") and subsequently refined through ~8 commits.

### Purpose
- Provide a centralized platform for university healthcare services
- Enable students/staff to book appointments with doctors across 13 medical departments
- Allow doctors to manage patient queues, write diagnoses, and issue digital prescriptions
- Track active medications with auto-expiry logic
- Maintain digital medical records and follow-up reminders

### Target Users
| Role | Description |
|------|-------------|
| **Student** | University students who need medical consultations |
| **Staff** | University staff members with the same healthcare access as students |
| **Doctor** | University-affiliated physicians across 13 departments |

### Business Workflow
1. Student/Staff **signs up** or **logs in**
2. User **describes symptoms** and **selects a department**
3. User **picks a doctor** from the selected department
4. User **selects a date and available time slot** → appointment booked
5. Doctor **views their appointment queue** (all non-completed appointments)
6. Doctor **starts treatment**: views patient history, writes diagnosis, prescribes medicine, optionally attaches reports (image/PDF as Base64), sets follow-up date
7. Treatment submission **marks appointment as Completed**, creates `MedicalRecord` and `Prescriptions`
8. User can **view medical records**, **active medicines** (with auto-expiry), and **follow-up reminders**

---

## 2. Tech Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Runtime** | Node.js | ≥14 | CommonJS modules |
| **Server Framework** | Express.js | 5.2.1 | Note: Express 5 (beta/RC at time of use) |
| **Database** | PostgreSQL | — | Via Neon (serverless Postgres) in production |
| **DB Driver** | pg (node-postgres) | 8.16.3 | Connection pool with SSL |
| **Auth** | JWT (jsonwebtoken) | 9.0.3 | 1-hour token expiry |
| **Password Hashing** | bcrypt | 6.0.0 | Salt rounds: 10 |
| **Environment** | dotenv | 17.2.3 | Loads from `backend/.env` |
| **CORS** | cors | 2.8.5 | Wide-open (no restrictions) |
| **Frontend** | Vanilla HTML/CSS/JS | — | No framework, no bundler |
| **Font** | DM Sans (Google Fonts) | — | CDN-loaded |
| **Deployment** | Vercel + Neon | — | Serverless Node + Serverless Postgres |

---

## 3. Folder Structure Analysis

```
KAPS_MedTech/
├── .agents/                         # AI skill configuration
│   └── skills/ui-ux-pro-max-skill/  # UI/UX design intelligence skill
├── .git/                            # Version control
├── .gitignore                       # Standard Node.js gitignore
├── DEPLOYMENT.md                    # Deployment guide for Vercel + Neon
├── README.md                        # Project documentation
├── package.json                     # Root package with all deps
├── package-lock.json                # Dependency lockfile
├── vercel.json                      # Vercel deployment configuration
│
├── backend/
│   ├── server.js                    # Express entry point (46 lines)
│   ├── db.js                        # PostgreSQL pool configuration (16 lines)
│   ├── schema.sql                   # DDL + seed data (254 lines)
│   ├── init_db.js                   # Schema executor script (21 lines)
│   │
│   ├── middleware/
│   │   └── auth.js                  # JWT verification middleware (18 lines)
│   │
│   ├── routes/
│   │   ├── auth.js                  # Login + Signup (91 lines)
│   │   ├── appointments.js          # Patient-facing CRUD (256 lines)
│   │   └── doctor.js                # Doctor-facing CRUD (139 lines)
│   │
│   ├── data/
│   │   └── store.json               # UNUSED — legacy flat-file data store
│   │
│   ├── diagnose.js                  # Debug: env + DB connection checker
│   ├── debug_hash.js                # Debug: bcrypt hash verification
│   ├── debug_records.js             # Debug: completed appointments check
│   ├── debug_records_full.js        # Debug: all appointments/records dump
│   ├── debug_user.js                # Debug: appointment owner lookup
│   ├── generate_hash.js             # Debug: generate bcrypt hash
│   ├── reset_pwd.js                 # Debug: reset specific user's password
│   ├── test_cardio_login.js         # Debug: test cardio doctor login
│   ├── test_db.js                   # Debug: test doctor insert (BROKEN — uses Supabase API)
│   ├── test_doctor_signup.js        # Debug: test doctor signup flow
│   ├── test_endpoint.js             # Debug: test record endpoint
│   └── test_medicine_expiry.js      # Debug: test medicine expiry logic
│
└── frontend/
    ├── index.html                   # Login/Signup page (294 lines)
    ├── dashboard_user.html          # Student/Staff dashboard (465 lines)
    ├── dashboard_doctor.html        # Doctor dashboard (322 lines)
    │
    ├── css/
    │   └── style.css                # Global stylesheet (313 lines)
    │
    ├── js/
    │   └── app.js                   # Shared app logic: API, auth, routing (83 lines)
    │
    └── img/
        └── logo.png                 # App logo (411 KB)
```

### Key Observations
- **9 debug/test files** in `backend/` root — development artifacts left in production code
- **1 dead data file** (`data/store.json`) — remnant from an earlier flat-file architecture
- **No separation** between page-specific JS and shared JS — all page logic is inline `<script>` blocks
- **All CSS in one file** + extensive inline `<style>` blocks in each HTML page
- **No build process** — raw files served directly

---

## 4. Component Relationships

```mermaid
graph TB
    subgraph Frontend ["Frontend (Vanilla HTML/CSS/JS)"]
        INDEX["index.html<br/>Login + Signup"]
        DASH_USER["dashboard_user.html<br/>Student/Staff Dashboard"]
        DASH_DOC["dashboard_doctor.html<br/>Doctor Dashboard"]
        APP_JS["app.js<br/>API wrapper + Auth + State"]
        STYLE["style.css<br/>Global Styles"]
    end

    subgraph Backend ["Backend (Express.js)"]
        SERVER["server.js<br/>Entry Point"]
        AUTH_MW["middleware/auth.js<br/>JWT Verification"]
        AUTH_RT["routes/auth.js<br/>Login + Signup"]
        APPT_RT["routes/appointments.js<br/>Patient APIs"]
        DOC_RT["routes/doctor.js<br/>Doctor APIs"]
        DB["db.js<br/>PostgreSQL Pool"]
    end

    subgraph Database ["PostgreSQL (Neon)"]
        USERS["Users"]
        DOCTORS["Doctors"]
        SYMPTOMS["Symptoms"]
        APPOINTMENTS["Appointments"]
        RECORDS["MedicalRecords"]
        PRESCRIPTIONS["Prescriptions"]
    end

    INDEX --> APP_JS
    DASH_USER --> APP_JS
    DASH_DOC --> APP_JS
    APP_JS -->|fetch| SERVER

    SERVER --> AUTH_RT
    SERVER --> APPT_RT
    SERVER --> DOC_RT

    AUTH_RT --> DB
    APPT_RT --> AUTH_MW
    APPT_RT --> DB
    DOC_RT --> AUTH_MW
    DOC_RT --> DB

    DB --> USERS
    DB --> DOCTORS
    DB --> SYMPTOMS
    DB --> APPOINTMENTS
    DB --> RECORDS
    DB --> PRESCRIPTIONS
```

---

## 5. API Flow

### Endpoints

| Method | Route | Auth | Role | Description |
|--------|-------|------|------|-------------|
| `POST` | `/api/auth/signup` | No | Any | Register new user (student/staff/doctor) |
| `POST` | `/api/auth/login` | No | Any | Authenticate, returns JWT |
| `GET` | `/api/health` | No | Any | DB connection health check |
| `GET` | `/api/appointments/symptoms` | No | Any | Search symptoms (ILIKE) |
| `GET` | `/api/appointments/doctors` | JWT | Any | List doctors by department |
| `GET` | `/api/appointments/slots` | JWT | Any | Get available time slots for a doctor+date |
| `POST` | `/api/appointments/book` | JWT | Any | Book an appointment |
| `GET` | `/api/appointments/my-appointments` | JWT | Patient | List user's appointments (filterable) |
| `GET` | `/api/appointments/medical-records` | JWT | Patient | Get user's medical records |
| `GET` | `/api/appointments/:id/record` | JWT | Any | Get single record by appointment ID |
| `GET` | `/api/appointments/my-medicine` | JWT | Patient | Active medicines (auto-expiry) |
| `GET` | `/api/appointments/reminders` | JWT | Patient | Future follow-up reminders |
| `PUT` | `/api/appointments/:id/reschedule` | JWT | Any | Reschedule appointment date/time |
| `GET` | `/api/doctor/today` | JWT | Doctor | Doctor's active appointments |
| `GET` | `/api/doctor/patient/:id` | JWT | Doctor | Patient info + medical history |
| `POST` | `/api/doctor/record` | JWT | Doctor | Submit diagnosis + prescriptions |
| `POST` | `/api/doctor/cancel` | JWT | Doctor | Cancel an appointment |

---

## 6. Database Schema

```mermaid
erDiagram
    Users {
        SERIAL id PK
        VARCHAR name
        VARCHAR email UK
        VARCHAR password_hash
        VARCHAR role "student|staff|doctor"
        VARCHAR identifier
        VARCHAR phone
        TIMESTAMP created_at
    }
    Doctors {
        SERIAL id PK
        INT user_id FK
        VARCHAR department
        VARCHAR specialty
        TIME availability_start "09:00"
        TIME availability_end "17:00"
    }
    Symptoms {
        SERIAL id PK
        VARCHAR name
        VARCHAR department
    }
    Appointments {
        SERIAL id PK
        INT patient_id FK
        INT doctor_id FK
        DATE appointment_date
        TIME appointment_time
        VARCHAR status "Booked|Completed|Cancelled"
        VARCHAR symptom_description
        TIMESTAMP created_at
    }
    MedicalRecords {
        SERIAL id PK
        INT appointment_id FK
        TEXT diagnosis
        TEXT advice
        TEXT attached_reports
        DATE follow_up_date
        TIMESTAMP created_at
    }
    Prescriptions {
        SERIAL id PK
        INT record_id FK
        VARCHAR medicine_name
        VARCHAR dosage
        VARCHAR frequency
        VARCHAR duration
    }

    Users ||--o| Doctors : "1:1 (if doctor)"
    Users ||--o{ Appointments : "patient_id"
    Doctors ||--o{ Appointments : "doctor_id"
    Appointments ||--o| MedicalRecords : "1:1"
    MedicalRecords ||--o{ Prescriptions : "1:many"
```

### Seed Data
- **65 doctors** across 13 departments (5 per department)
- **48 symptoms** mapped to departments
- All doctors share the same bcrypt hash for `password123`

---

## 7. Authentication Flow

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant S as Express Server
    participant DB as PostgreSQL

    U->>S: POST /api/auth/login {email, password}
    S->>DB: SELECT * FROM Users WHERE email = ?
    DB-->>S: User row (with password_hash)
    S->>S: bcrypt.compare(password, password_hash)
    alt Match
        S->>S: jwt.sign({id, role, name}, JWT_SECRET, 1h)
        S-->>U: {token, role, name, id}
        U->>U: localStorage.setItem('token', token)
        U->>U: Redirect to dashboard
    else No Match
        S-->>U: 401 {error: "Invalid credentials"}
    end

    Note over U,S: Subsequent requests include<br/>Authorization: Bearer <token>
    U->>S: GET /api/appointments/doctors
    S->>S: authenticateToken middleware
    S->>S: jwt.verify(token, JWT_SECRET)
    alt Valid
        S->>DB: Query
        DB-->>S: Result
        S-->>U: 200 JSON
    else Invalid/Expired
        S-->>U: 401 or 403
        U->>U: App.logout() → redirect to login
    end
```

### Key Design Decisions
- JWT stored in `localStorage` (not httpOnly cookies)
- Token carries `{id, role, name}` — role-based routing happens client-side
- No token refresh mechanism — hard 1-hour expiry
- JWT secret fallback to `'secret'` if env var is missing (security risk)

---

## 8. User Flow

### Student/Staff Flow
```mermaid
flowchart LR
    A[Login Page] -->|Login| B{Role?}
    B -->|student/staff| C[User Dashboard]
    C --> D[Book Appointment]
    C --> E[My Appointments]
    C --> F[Medical Records]
    C --> G[My Medicine]
    C --> H[Reminders]

    D --> D1[Enter Reason]
    D1 --> D2[Select Department]
    D2 --> D3[Select Doctor]
    D3 --> D4[Pick Date + Slot]
    D4 --> D5[Confirm Booking]

    E --> E1[View/Filter Appointments]
    E1 --> E2[View Record for Completed]

    F --> F1[Browse All Records]
    G --> G1[View Active Medicines]
    H --> H1[View Follow-up Dates]
```

### Doctor Flow
```mermaid
flowchart LR
    A[Login Page] -->|Login| B{Role?}
    B -->|doctor| C[Doctor Dashboard]
    C --> D[View Active Queue]
    D --> D1[Start Treatment]
    D --> D2[Cancel Appointment]

    D1 --> T1[View Patient Info + History]
    T1 --> T2[Write Diagnosis + Advice]
    T2 --> T3[Attach Reports]
    T3 --> T4[Set Follow-up Date]
    T4 --> T5[Add Prescriptions]
    T5 --> T6[Update Patient Details]
    T6 --> T7[Submit → Marks Complete]
```

---

## 9. Existing Strengths

| # | Strength | Details |
|---|----------|---------|
| 1 | **Well-structured SQL schema** | Proper foreign keys, CASCADE constraints, CHECK constraints on role/status |
| 2 | **Transaction usage** | Signup and doctor record submission use `BEGIN/COMMIT/ROLLBACK` |
| 3 | **JWT authentication** | Standard Bearer token pattern with middleware |
| 4 | **Role-based authorization** | `requireDoctor` middleware on doctor routes |
| 5 | **Parameterized queries** | All SQL uses `$1, $2...` parameters — prevents SQL injection |
| 6 | **Bcrypt for passwords** | Industry-standard hashing with salt rounds |
| 7 | **Auto-expiry logic** | Medicine cabinet intelligently hides expired prescriptions |
| 8 | **Multi-step booking wizard** | Clean UX flow: reason → department → doctor → date → slot |
| 9 | **Dark theme design system** | CSS variables, consistent visual language |
| 10 | **Clean deployment config** | Vercel + Neon setup is well-documented and functional |
| 11 | **Health check endpoint** | `/api/health` for monitoring |
| 12 | **Vercel-compatible export** | `module.exports = app` with conditional `listen()` |
| 13 | **Comprehensive seed data** | 65 doctors, 48 symptoms across 13 departments |

---

## 10. Existing Weaknesses

| # | Category | Issue | Severity |
|---|----------|-------|----------|
| 1 | **Dead Code** | 9 debug/test files in backend root | Medium |
| 2 | **Dead Code** | `data/store.json` is unused legacy | Low |
| 3 | **Dead Code** | `test_db.js` uses Supabase API (wrong driver) | Low |
| 4 | **Security** | JWT fallback to `'secret'` if env var missing | Critical |
| 5 | **Security** | CORS wide open (`app.use(cors())`) | High |
| 6 | **Security** | Token in localStorage (XSS vulnerability) | Medium |
| 7 | **Security** | `reset_pwd.js` has hardcoded personal email | Medium |
| 8 | **Security** | No rate limiting on login/signup | High |
| 9 | **Security** | All seed doctors share same password hash | Medium |
| 10 | **Security** | Error messages expose internal DB details (`err.message`, `err.code`) | High |
| 11 | **Architecture** | All page JS is inline in HTML files | High |
| 12 | **Architecture** | No input validation on backend (beyond basic field presence) | High |
| 13 | **Architecture** | No logging framework (only `console.error`) | Medium |
| 14 | **Architecture** | `express.json({ limit: '50mb' })` — extremely high | Medium |
| 15 | **Architecture** | Base64 file storage in DB `TEXT` column | High |
| 16 | **Authorization** | `/api/appointments/:id/record` doesn't verify ownership | Critical |
| 17 | **Authorization** | `/api/appointments/:id/reschedule` doesn't verify ownership | Critical |
| 18 | **Authorization** | `/api/doctor/cancel` doesn't verify doctor owns appointment | High |
| 19 | **Frontend** | No loading/skeleton states (just "Loading..." text) | Medium |
| 20 | **Frontend** | No empty state designs | Medium |
| 21 | **Frontend** | No error feedback UI (uses `alert()`) | High |
| 22 | **Frontend** | Not responsive (split layout breaks on mobile) | High |
| 23 | **Frontend** | Inline styles throughout HTML | Medium |
| 24 | **Frontend** | `mb-8` class used in HTML but not defined in CSS | Low |
| 25 | **Database** | No indexes beyond primary keys | Medium |
| 26 | **Database** | `attached_reports` as TEXT (Base64) — scales poorly | High |
| 27 | **Database** | `ssl: { rejectUnauthorized: false }` hardcoded | Medium |
| 28 | **Database** | `dotenv.config()` called in multiple files | Low |
| 29 | **Performance** | Doctor `/today` loads ALL non-completed (not date-filtered) | Medium |
| 30 | **UX** | `window.location.reload()` after booking | Low |
| 31 | **UX** | No confirmation modal before actions (uses browser `confirm()`) | Medium |
| 32 | **UX** | No pagination on any list | Medium |
| 33 | **Testing** | No automated tests | High |
| 34 | **Documentation** | No API reference | Medium |
| 35 | **Documentation** | No architecture docs | Medium |

---

## 11. Overall Architecture Diagram

```mermaid
graph TB
    subgraph Client ["Client (Browser)"]
        direction TB
        LP["Login Page<br/>index.html"]
        UD["User Dashboard<br/>dashboard_user.html"]
        DD["Doctor Dashboard<br/>dashboard_doctor.html"]
        JS["app.js<br/>API Client + Auth"]
        CSS["style.css<br/>Design System"]
    end

    subgraph Vercel ["Vercel (Serverless)"]
        direction TB
        EX["Express Server<br/>server.js"]
        MW["Auth Middleware<br/>JWT Verify"]

        subgraph Routes ["API Routes"]
            R1["/api/auth<br/>Login + Signup"]
            R2["/api/appointments<br/>Booking + Records"]
            R3["/api/doctor<br/>Treatment + Queue"]
        end

        EX --> MW
        EX --> R1
        EX --> R2
        EX --> R3
        MW -.-> R2
        MW -.-> R3
    end

    subgraph Neon ["Neon (Serverless Postgres)"]
        direction LR
        T1["Users"]
        T2["Doctors"]
        T3["Symptoms"]
        T4["Appointments"]
        T5["MedicalRecords"]
        T6["Prescriptions"]
    end

    Client -->|HTTPS + JWT| Vercel
    Vercel -->|pg Pool + SSL| Neon
    LP --> JS
    UD --> JS
    DD --> JS

    style Client fill:#1a1a2e,stroke:#333,color:#fff
    style Vercel fill:#0f3460,stroke:#333,color:#fff
    style Neon fill:#16213e,stroke:#333,color:#fff
```

---

## 12. Summary

KAPS MedTech is a competently structured hackathon project with a solid database schema, sensible business logic, and working end-to-end flows. The core workflow — appointment booking through diagnosis — functions correctly.

However, it carries the hallmarks of rapid development:
- **Security gaps** in authorization, error exposure, and JWT configuration
- **No separation of concerns** on the frontend (monolithic HTML files with inline scripts)
- **Dead development artifacts** scattered through the backend
- **No automated tests** or structured error handling
- **Missing responsive design** and modern UX patterns

The codebase is small (~2,800 lines across all source files) and well-scoped, making it an excellent candidate for systematic improvement without requiring a rewrite.
