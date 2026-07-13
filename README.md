# KAPS MedTech 🏥

A secure, premium, and highly responsive healthcare management system connecting **Students/Staff** with **University Doctors** in real-time.  
*Built with modern architecture guidelines, YAGNI minimalism, and clinical dark aesthetics.* 🚀

---

## 🌐 Live Application
You can access the deployed application directly here:  
👉 **[Live App Link (Click Here)](https://kaps-medtech.vercel.app/)** 🔗  
---

## 📖 System Overview

**KAPS MedTech** is a full-stack university clinic dashboard that simplifies medical appointments, diagnosis recording, prescription fulfillment, and patient reminders. The platform is hardened with enterprise security layers (rate limiters, token validation checks, and resource scope checks) and runs smoothly in serverless cloud environments (Neon Serverless PostgreSQL + Vercel).

---

## 🌟 Key Features & Updates

### 👨‍🎓 For Students & Staff (`student` / `staff` roles)
- **Smart Symptom Dropdown & Auto-Matching**: Choose from 30+ common symptoms or type custom descriptions. The dashboard queries the database in real-time to suggest the appropriate department and highlights the recommended card.
- **Symptom Mismatch Safeguards**: A dynamic guard warns patients if they try to book an appointment with a department that doesn't match their description (e.g. typing *"knee pain"* but selecting *"ENT"*).
- **Interactive Doctor Cards**: View available doctors with human-readable specializations (e.g. *"Brain & Nervous System Specialist"* instead of raw internal codes).
- **Auto-Expiring Medicine Cabinet**: Lists only active medications based on the doctor's prescribed duration, auto-hiding expired entries.
- **Follow-up Reminders**: Displays upcoming scheduled follow-up dates and doctor notes chronologically.

### 👨‍⚕️ For Doctors (`doctor` role)
- **Real-Time Queue Console**: View daily patient lists sorted chronologically.
- **Unified Treatment Panel**: Write diagnoses, attach advice, set follow-up dates, and add dynamic medication rows in one form.
- **Prior Patient History**: Access previous diagnoses and historical treatment records securely before finalizing a new record.

### 🎨 General & UX Enhancements
- **Clinical Dark & Slate-Teal Theme**: Standardized visual style utilizing glassmorphism surfaces, smooth hover micro-animations, and high-contrast typography.
- **Consolidated Toast Notifications**: Replaced native browser `alert()` pop-ups with a global, non-blocking notification drawer (`App.showToast`).

---

## 🏗️ Architecture & Data Flow

```mermaid
graph TD
    Client[Web Browser / HTML5 + JS]
    API_Gateway[Express REST Server]
    Auth_Middleware[JWT Scopes & Rate Limiter]
    DB_Pool[PostgreSQL Connection Pool]
    DB[(Supabase / Neon Cloud Database)]

    Client -->|1. REST Requests| API_Gateway
    API_Gateway -->|2. Authorize Token| Auth_Middleware
    Auth_Middleware -->|3. Route Handlers| DB_Pool
    DB_Pool -->|4. Pool Queries / SSL| DB
```

### Database Schema Entity Relationships
- **Users**: Holds names, logins, hashed passwords, roles (`student`, `staff`, `doctor`), and details.
- **Doctors**: Linked 1-to-1 with a User, defines department scope and specialty.
- **Symptoms**: Dictionary of common phrases mapped to department recommendations.
- **Appointments**: Maps patients, doctors, date, time, and active booking states.
- **MedicalRecords**: Linked to Appointments, stores diagnoses, advice, and attachments.
- **Prescriptions**: Linked to MedicalRecords, lists active medicines, dosage, and duration.

---

## 🔐 Security Protections
1. **IP Rate-Limiting**: Restricts brute-force authentication attacks on login/signup endpoints.
2. **Access Isolation Guards**: Restricts endpoint calls (like rescheduling or fetching medical files) to the specific patient or doctor associated with the record.
3. **Information Disclosure Prevention**: Sanitizes server exceptions to return generic status responses while logging detailed stack traces securely.
4. **SSL Enforcement**: Configured to require secure SSL handles for cloud-hosted Neon/Supabase endpoints.

---

## 🚀 Local Development Setup

### Prerequisites
- **Node.js** (v18 or higher)
- **PostgreSQL** (Local instance or Neon/Supabase cloud database string)

### 1. Installation & Settings
Clone the repository and install the lightweight dependency tree:
```bash
git clone https://github.com/Pushpam-2404/KAPS_MedTech.git
cd KAPS_MedTech
npm install
```

### 2. Configure Environment Variables
Create a file named `.env` in the `backend/` directory:
```env
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/kaps_health
JWT_SECRET=use_a_secure_random_key_here
PORT=3001
```

### 3. Initialize & Seed Database
Setup tables, create relational foreign keys, indexes, and populate all symptoms and doctors:
```bash
node backend/init_db.js
```

### 4. Start the Application
Launch the Node development server:
```bash
npm start
```
Open **`http://localhost:3001`** in your browser.

---

## 🧪 Running Integration Tests
We maintain an automated Node test runner verifying 29 functional checks (input validation, rate limiting, duplicate protection, queue completion, and resource isolation):
```bash
node backend/integration_test.js
```

---

## 🔑 Demo Credentials

Use these preseeded accounts to explore the system:

| Role | Email | Password | Details |
| :--- | :--- | :--- | :--- |
| **Student** | `student@university.edu` | `password123` | Patient role, sample history, active medications. |
| **Staff** | `staff@university.edu` | `password123` | Patient role with staff profile badge. |
| **Doctor** | `doctor@university.edu` | `password123` | Neurology doctor (Dr. Mohit Khanna). |
| **Doctor** | `cardio_demo@health.edu` | `password123` | Cardiology doctor (Dr. Kunal Mehta). |
