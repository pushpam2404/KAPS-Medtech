-- Brings an existing database up to date. Safe to run more than once.
-- Run with: npm run db:migrate

-- Double-booking guard
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_slot
    ON Appointments(doctor_id, appointment_date, appointment_time)
    WHERE status <> 'Cancelled';

-- Per-doctor availability
ALTER TABLE Doctors ADD COLUMN IF NOT EXISTS working_days SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5}';
UPDATE Doctors SET availability_start = '09:00' WHERE availability_start IS NULL;
UPDATE Doctors SET availability_end = '17:00' WHERE availability_end IS NULL;
ALTER TABLE Doctors ALTER COLUMN availability_start SET NOT NULL, ALTER COLUMN availability_end SET NOT NULL;

CREATE TABLE IF NOT EXISTS DoctorDaysOff (
    id SERIAL PRIMARY KEY,
    doctor_id INT NOT NULL REFERENCES Doctors(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(100),
    CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_days_off_doctor ON DoctorDaysOff(doctor_id, start_date, end_date);

-- Audit trail
CREATE TABLE IF NOT EXISTS AuditLog (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,
    target_type VARCHAR(30),
    target_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON AuditLog(user_id, created_at);
