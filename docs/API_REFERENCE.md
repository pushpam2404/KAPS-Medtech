# KAPS MedTech — API Reference

This document lists all active REST endpoints exposed by the **KAPS MedTech** Express backend, along with their parameters, request payloads, response templates, and security levels.

---

## 1. Authentication Endpoints

### Register User
Registers a student, staff, or doctor.
- **Endpoint**: `/api/auth/signup`
- **Method**: `POST`
- **Auth Required**: None
- **Request Body**:
  ```json
  {
    "name": "Dr. Sarah Conner",
    "email": "sconner@health.edu",
    "password": "securepassword123",
    "role": "doctor",
    "identifier": "DR999",
    "phone": "555-0909",
    "department": "Cardiology",
    "specialty": "Heart Surgeon"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "message": "User registered successfully"
  }
  ```

### Login
Authenticates credentials and returns a JWT token.
- **Endpoint**: `/api/auth/login`
- **Method**: `POST`
- **Auth Required**: None (Subject to IP Rate-limiting)
- **Request Body**:
  ```json
  {
    "email": "student@university.edu",
    "password": "password123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "role": "student",
    "name": "Alice Student",
    "id": 2
  }
  ```

---

## 2. Patient Booking & Consultation Endpoints

### List Doctors
Gets available doctors filtered by department.
- **Endpoint**: `/api/appointments/doctors`
- **Method**: `GET`
- **Auth Required**: JWT (Student/Staff/Doctor)
- **Query Parameters**:
  - `department` (optional string): e.g. `Cardiology`
- **Response (200 OK)**:
  ```json
  [
    {
      "id": 6,
      "name": "Dr. Arjun Patel",
      "department": "Cardiology",
      "specialty": "CARD001"
    }
  ]
  ```

### List Slots
Calculates vacant half-hour slots for a doctor on a specific date.
- **Endpoint**: `/api/appointments/slots`
- **Method**: `GET`
- **Auth Required**: JWT
- **Query Parameters**:
  - `doctor_id` (required integer)
  - `date` (required string, format: `YYYY-MM-DD`)
- **Response (200 OK)**:
  ```json
  [
    "09:00",
    "09:30",
    "10:00",
    "11:00"
  ]
  ```

### Book Appointment
Registers an appointment slot. Protects against race conditions.
- **Endpoint**: `/api/appointments/book`
- **Method**: `POST`
- **Auth Required**: JWT
- **Request Body**:
  ```json
  {
    "doctor_id": 6,
    "date": "2026-07-20",
    "time": "10:30",
    "symptom": "Frequent palpitation chest discomfort"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "message": "Appointment booked"
  }
  ```
- **Response (409 Conflict)**:
  ```json
  {
    "error": "This time slot has already been booked"
  }
  ```

### Reschedule Appointment
Updates the date or time of a booked appointment. Verified for owner authorization.
- **Endpoint**: `/api/appointments/:id/reschedule`
- **Method**: `PUT`
- **Auth Required**: JWT (Patient Owner Only)
- **Request Body**:
  ```json
  {
    "date": "2026-07-21",
    "time": "11:00"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Rescheduled"
  }
  ```

---

## 3. Clinical / Doctor Console Endpoints

### Fetch Doctor Queue
Retrieves active appointments assigned to the logged-in doctor.
- **Endpoint**: `/api/doctor/today`
- **Method**: `GET`
- **Auth Required**: JWT (Doctor Role Only)
- **Response (200 OK)**:
  ```json
  [
    {
      "id": 12,
      "appointment_time": "10:30:00",
      "status": "Booked",
      "symptom_description": "Frequent palpitations",
      "patient_name": "Alice Student",
      "patient_id": 2,
      "patient_phone": "555-0102",
      "patient_email": "student@test.com"
    }
  ]
  ```

### Save Consultation / Record
Stores the doctor's clinical assessment, attaches reports, logs updates, and marks the appointment as Completed.
- **Endpoint**: `/api/doctor/record`
- **Method**: `POST`
- **Auth Required**: JWT (Doctor Role Only)
- **Request Body**:
  ```json
  {
    "appointment_id": 12,
    "diagnosis": "Sinus Arrhythmia",
    "advice": "Avoid caffeine, rest and monitor heart rate",
    "attached_reports": "data:image/png;base64,iVBORw0KG...",
    "follow_up_date": "2026-08-12",
    "prescriptions": [
      {
        "name": "Beta Blockers",
        "dosage": "50mg",
        "freq": "Once daily",
        "duration": "14 days"
      }
    ],
    "patient_updates": {
      "phone": "555-0987",
      "identifier": "STU456-A"
    }
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Record saved"
  }
  ```

### Cancel Appointment
Cancels a pending appointment. Enforces doctor ownership.
- **Endpoint**: `/api/doctor/cancel`
- **Method**: `POST`
- **Auth Required**: JWT (Doctor Role Only)
- **Request Body**:
  ```json
  {
    "appointment_id": 12
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "message": "Appointment Cancelled"
  }
  ```
