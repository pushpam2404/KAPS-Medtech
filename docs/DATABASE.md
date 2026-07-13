# KAPS MedTech — Database Documentation

This document describes the database schema design, table relationships, performance indexes, and transactional query constraints used in the **KAPS MedTech** application.

---

## 1. Relational Entity Diagram

The schema contains 6 primary tables configured in a fully normalized structure:

```
  +-------------+          +-------------+
  |    Users    | 1 ---- * | Doctors     |
  |  (patients) |          | (clinicians)|
  +------+------+          +------+------+
         | 1                      | 1
         |                        |
         | *                      | *
  +------+------------------------v------+
  |             Appointments             |
  | (symptom descriptions, status slots) |
  +------------------+-------------------+
                     | 1
                     |
                     | 1
  +------------------v-------------------+
  |            MedicalRecords            |
  |   (diagnosis text, follow-up date)   |
  +------------------+-------------------+
                     | 1
                     |
                     | *
  +------------------v-------------------+
  |            Prescriptions             |
  | (medication dosage, duration, frequency)|
  +--------------------------------------+
```

---

## 2. Table Definitions & Constraints

### Users
Stores patient (student/staff) and clinician records.
- `id` (SERIAL, Primary Key)
- `name` (VARCHAR(100), NOT NULL)
- `email` (VARCHAR(100), UNIQUE, NOT NULL)
- `password_hash` (VARCHAR(255), NOT NULL)
- `role` (VARCHAR(20), NOT NULL): Enforced via CHECK constraint to be one of `('student', 'staff', 'doctor')`
- `identifier` (VARCHAR(50)): Student ID / Doctor license tag
- `phone` (VARCHAR(20))
- `created_at` (TIMESTAMP, default: `CURRENT_TIMESTAMP`)

### Doctors
Linked 1:1 with `Users` for doctor accounts.
- `id` (SERIAL, Primary Key)
- `user_id` (INT): References `Users(id)` with ON DELETE CASCADE
- `department` (VARCHAR(50), NOT NULL)
- `specialty` (VARCHAR(100))
- `availability_start` (TIME, default: `'09:00:00'`)
- `availability_end` (TIME, default: `'17:00:00'`)

### Symptoms
Unused mapping reference for symptom matching.
- `id` (SERIAL, Primary Key)
- `name` (VARCHAR(100), NOT NULL)
- `department` (VARCHAR(50), NOT NULL)

### Appointments
Coordinates scheduling slots.
- `id` (SERIAL, Primary Key)
- `patient_id` (INT): References `Users(id)`
- `doctor_id` (INT): References `Doctors(id)`
- `appointment_date` (DATE, NOT NULL)
- `appointment_time` (TIME, NOT NULL)
- `status` (VARCHAR(20), default: `'Booked'`): Enforced via CHECK constraint to be one of `('Booked', 'Completed', 'Cancelled')`
- `symptom_description` (VARCHAR(255))
- `created_at` (TIMESTAMP, default: `CURRENT_TIMESTAMP`)

### MedicalRecords
Records created after a completed appointment consultation.
- `id` (SERIAL, Primary Key)
- `appointment_id` (INT): References `Appointments(id)`
- `diagnosis` (TEXT, NOT NULL)
- `advice` (TEXT)
- `attached_reports` (TEXT): Base64 encoded PDF/image assets or text links
- `follow_up_date` (DATE)
- `created_at` (TIMESTAMP, default: `CURRENT_TIMESTAMP`)

### Prescriptions
Individual medication list items linked to a diagnosis record.
- `id` (SERIAL, Primary Key)
- `record_id` (INT): References `MedicalRecords(id)`
- `medicine_name` (VARCHAR(100), NOT NULL)
- `dosage` (VARCHAR(50), NOT NULL)
- `frequency` (VARCHAR(50), NOT NULL)
- `duration` (VARCHAR(50), NOT NULL)

---

## 3. Database Performance Indexes

The database uses several indexes on frequently queried foreign key fields to speed up operations and ensure high-throughput queries:

1. **`idx_appointments_patient`**: Applied to `Appointments(patient_id)`. Optimizes loading the history of patient visits on the User Dashboard.
2. **`idx_appointments_doctor_date`**: Applied to `Appointments(doctor_id, appointment_date)`. Speeds up the loading of free time slots and doctor queues.
3. **`idx_appointments_status`**: Applied to `Appointments(status)`. Accelerates active/completed status aggregations.
4. **`idx_doctors_user`**: Applied to `Doctors(user_id)`. Links users to their profile credentials.
5. **`idx_medical_records_appointment`**: Applied to `MedicalRecords(appointment_id)`. Speeds up medical records lookups for specific visits.
6. **`idx_prescriptions_record`**: Applied to `Prescriptions(record_id)`. Speeds up prescription mapping on a patient's active prescription timeline.
7. **`idx_symptoms_department`**: Applied to `Symptoms(department)`. Speeds up department matching in the booking wizard.

---

## 4. Query Safeguards & Optimization

- **Cascading Deletions**: Deleting a parent user cleans up related doctor records, appointments, diagnostics, and prescriptions.
- **Race Condition Prevention**: The API booking routes perform queries matching `doctor_id`, `appointment_date`, and `appointment_time` (where status is not Cancelled) before creating appointments to prevent double-booking.
- **Transaction Safety**: Registrations and consultation submissions use SQL transactions (`BEGIN`, `COMMIT`, `ROLLBACK`) to guarantee that clinical updates, status transitions, and prescriptions are recorded atomically.
