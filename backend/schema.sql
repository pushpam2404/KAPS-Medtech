-- WARNING: this file DROPS and recreates every table. Run it on an empty
-- database, never on one that already holds real data. To bring an existing
-- database up to date without losing data, run `npm run db:migrate` instead.
--
-- Seeded doctor accounts use the demo password "password123".

-- ===============================
-- CLEAN SLATE
-- ===============================
DROP TABLE IF EXISTS AuditLog CASCADE;
DROP TABLE IF EXISTS DoctorDaysOff CASCADE;
DROP TABLE IF EXISTS Prescriptions CASCADE;
DROP TABLE IF EXISTS MedicalRecords CASCADE;
DROP TABLE IF EXISTS Appointments CASCADE;
DROP TABLE IF EXISTS Symptoms CASCADE;
DROP TABLE IF EXISTS Doctors CASCADE;
DROP TABLE IF EXISTS Users CASCADE;

-- ===============================
-- 1. USERS
-- ===============================
CREATE TABLE Users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) CHECK (role IN ('student', 'staff', 'doctor')) NOT NULL,
    identifier VARCHAR(50),
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- 2. DOCTORS
-- ===============================
CREATE TABLE Doctors (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    department VARCHAR(50) NOT NULL,
    specialty VARCHAR(100),
    availability_start TIME NOT NULL DEFAULT '09:00:00',
    availability_end TIME NOT NULL DEFAULT '17:00:00',
    -- ISO weekdays the doctor sees patients: 1 = Monday ... 7 = Sunday
    working_days SMALLINT[] NOT NULL DEFAULT '{1,2,3,4,5}',
    CHECK (availability_end > availability_start)
);

-- Blocks of whole days when a doctor takes no bookings (both ends inclusive).
CREATE TABLE DoctorDaysOff (
    id SERIAL PRIMARY KEY,
    doctor_id INT NOT NULL REFERENCES Doctors(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason VARCHAR(100),
    CHECK (end_date >= start_date)
);

-- Who looked at or changed patient data.
CREATE TABLE AuditLog (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES Users(id) ON DELETE SET NULL,
    action VARCHAR(40) NOT NULL,
    target_type VARCHAR(30),
    target_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- 3. SYMPTOMS
-- ===============================
CREATE TABLE Symptoms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(50) NOT NULL
);

-- ===============================
-- 4. APPOINTMENTS
-- ===============================
CREATE TABLE Appointments (
    id SERIAL PRIMARY KEY,
    patient_id INT REFERENCES Users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    doctor_id INT REFERENCES Doctors(id) ON DELETE CASCADE ON UPDATE CASCADE,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    status VARCHAR(20) DEFAULT 'Booked'
        CHECK (status IN ('Booked', 'Completed', 'Cancelled')),
    symptom_description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- 5. MEDICAL RECORDS
-- ===============================
CREATE TABLE MedicalRecords (
    id SERIAL PRIMARY KEY,
    appointment_id INT REFERENCES Appointments(id) ON DELETE CASCADE ON UPDATE CASCADE,
    diagnosis TEXT NOT NULL,
    advice TEXT,
    attached_reports TEXT,
    follow_up_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- 6. PRESCRIPTIONS
-- ===============================
CREATE TABLE Prescriptions (
    id SERIAL PRIMARY KEY,
    record_id INT REFERENCES MedicalRecords(id) ON DELETE CASCADE ON UPDATE CASCADE,
    medicine_name VARCHAR(100) NOT NULL,
    dosage VARCHAR(50) NOT NULL,
    frequency VARCHAR(50) NOT NULL,
    duration VARCHAR(50) NOT NULL
);

-- ===============================
-- SEED: DOCTOR USERS
-- ===============================
INSERT INTO Users (name, email, password_hash, role, identifier, phone) VALUES
-- General Physicians
('Dr. Anil Sharma','gp1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','GP001','9000000001'),
('Dr. Kavya Rao','gp2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','GP002','9000000002'),
('Dr. Rohan Mehta','gp3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','GP003','9000000003'),
('Dr. Neha Verma','gp4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','GP004','9000000004'),
('Dr. Suresh Iyer','gp5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','GP005','9000000005'),

-- Cardiologists
('Dr. Arjun Patel','cardio1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','CARD001','9000000011'),
('Dr. Sneha Kulkarni','cardio2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','CARD002','9000000012'),
('Dr. Vikram Singh','cardio3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','CARD003','9000000013'),
('Dr. Pooja Nair','cardio4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','CARD004','9000000014'),
('Dr. Aman Gupta','cardio5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','CARD005','9000000015'),

-- Pulmonologists
('Dr. Rahul Das','pulmo1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','PUL001','9000000021'),
('Dr. Ayesha Khan','pulmo2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','PUL002','9000000022'),
('Dr. Kiran Joshi','pulmo3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','PUL003','9000000023'),
('Dr. Mehul Shah','pulmo4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','PUL004','9000000024'),
('Dr. Tanya Roy','pulmo5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','PUL005','9000000025'),

-- Gastroenterologists
('Dr. Nitin Malhotra','gas1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','GAS001','9000000031'),
('Dr. Ritu Bansal','gas2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','GAS002','9000000032'),
('Dr. Sanjay Kulkarni','gas3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','GAS003','9000000033'),
('Dr. Pankaj Arora','gas4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','GAS004','9000000034'),
('Dr. Isha Jain','gas5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','GAS005','9000000035'),

-- Neurologists
('Dr. Mohit Khanna','neuro1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','NEU001','9000000041'),
('Dr. Swati Mishra','neuro2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','NEU002','9000000042'),
('Dr. Abhishek Roy','neuro3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','NEU003','9000000043'),
('Dr. Ramesh Pillai','neuro4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','NEU004','9000000044'),
('Dr. Nisha Kapoor','neuro5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','NEU005','9000000045'),

-- Orthopedics
('Dr. Pradeep Menon','ortho1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','ORT001','9000000051'),
('Dr. Akash Verma','ortho2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','ORT002','9000000052'),
('Dr. Sunita Rao','ortho3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','ORT003','9000000053'),
('Dr. Harish Shetty','ortho4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','ORT004','9000000054'),
('Dr. Nilesh Patil','ortho5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','ORT005','9000000055'),

-- Dermatologists
('Dr. Shalini Gupta','derma1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','DER001','9000000061'),
('Dr. Pritam Bose','derma2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','DER002','9000000062'),
('Dr. Aditi Chawla','derma3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','DER003','9000000063'),
('Dr. Raghav Soni','derma4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','DER004','9000000064'),
('Dr. Meera Iyer','derma5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','DER005','9000000065'),

-- Psychiatry
('Dr. Sameer Kulkarni','psy1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','PSY001','9000000071'),
('Dr. Ananya Sen','psy2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','PSY002','9000000072'),
('Dr. Farhan Ali','psy3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','PSY003','9000000073'),
('Dr. Lavanya Rao','psy4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','PSY004','9000000074'),
('Dr. Deepak Nair','psy5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','PSY005','9000000075'),

-- ENT
('Dr. Kunal Mehta','ent1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','ENT001','9000000081'),
('Dr. Riya Agarwal','ent2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','ENT002','9000000082'),
('Dr. Mahesh Patkar','ent3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','ENT003','9000000083'),
('Dr. Sonal Joshi','ent4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','ENT004','9000000084'),
('Dr. Vinod Kulkarni','ent5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','ENT005','9000000085'),

-- Ophthalmology
('Dr. Alok Srivastava','eye1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','EYE001','9000000091'),
('Dr. Pooja Malhotra','eye2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','EYE002','9000000092'),
('Dr. Nikhil Jain','eye3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','EYE003','9000000093'),
('Dr. Renu Thomas','eye4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','EYE004','9000000094'),
('Dr. Sandeep Rao','eye5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','EYE005','9000000095'),

-- Endocrinology
('Dr. Shyam Iyer','endo1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','END001','9000000101'),
('Dr. Neelam Joshi','endo2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','END002','9000000102'),
('Dr. Varun Malhotra','endo3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','END003','9000000103'),
('Dr. Kanchan Shah','endo4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','END004','9000000104'),
('Dr. Prakash Nair','endo5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','END005','9000000105'),

-- Nephrology
('Dr. Ashok Reddy','neph1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','NEPH001','9000000111'),
('Dr. Monica Jain','neph2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','NEPH002','9000000112'),
('Dr. Rajiv Bansal','neph3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','NEPH003','9000000113'),
('Dr. Snehal Patil','neph4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','NEPH004','9000000114'),
('Dr. Imran Khan','neph5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','NEPH005','9000000115'),

-- Dentistry
('Dr. Amit Kulkarni','dent1@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','DEN001','9000000121'),
('Dr. Shruti Mehra','dent2@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','DEN002','9000000122'),
('Dr. Karthik R','dent3@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','DEN003','9000000123'),
('Dr. Preeti Sinha','dent4@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','DEN004','9000000124'),
('Dr. Vinay Deshpande','dent5@health.edu','$2b$10$nQZ/VD/PwBWWm4M0sHPsIeeQhwc2z16beXeJ6dgq/CG3UkDpoRoBK','doctor','DEN005','9000000125');


INSERT INTO Symptoms (name, department) VALUES
-- General Medicine
('Fever', 'General Medicine'),
('Cold & Flu Symptoms', 'General Medicine'),
('Body Ache', 'General Medicine'),
('Fatigue / Weakness', 'General Medicine'),
('Allergic Reaction', 'General Medicine'),
('Wound / Infection', 'General Medicine'),
('Weight Loss (Unexplained)', 'General Medicine'),
('Chills / Shivering', 'General Medicine'),
('Exhaustion / Run Down', 'General Medicine'),
('General Checkup', 'General Medicine'),
('Prescription Renewal', 'General Medicine'),
-- Cardiology
('Chest Pain', 'Cardiology'),
('Heart Palpitations', 'Cardiology'),
('High Blood Pressure', 'Cardiology'),
('Chest Tightness / Pressure', 'Cardiology'),
('Heart Racing / Arrhythmia', 'Cardiology'),
('Irregular Heartbeat', 'Cardiology'),
('Shortness of breath on exertion', 'Cardiology'),
('Hypertension', 'Cardiology'),
('Angina', 'Cardiology'),
-- Pulmonology
('Asthma / Breathing Difficulty', 'Pulmonology'),
('Cough', 'Pulmonology'),
('Persistent Cough', 'Pulmonology'),
('Respiratory Infection', 'Pulmonology'),
('Wheezing / Chest Tightness', 'Pulmonology'),
('Bronchitis', 'Pulmonology'),
('Lung Pain', 'Pulmonology'),
('Shortness of breath', 'Pulmonology'),
('Phlegm / Sputum production', 'Pulmonology'),
-- Gastroenterology
('Abdominal Pain', 'Gastroenterology'),
('Acidity / Heartburn', 'Gastroenterology'),
('Constipation', 'Gastroenterology'),
('Diarrhea', 'Gastroenterology'),
('Gastritis / Ulcer', 'Gastroenterology'),
('Liver Disorder', 'Gastroenterology'),
('Nausea / Vomiting', 'Gastroenterology'),
('Stomach Infection', 'Gastroenterology'),
('Vomiting Blood / GI Bleed', 'Gastroenterology'),
('Bloating / Gas', 'Gastroenterology'),
('Stomach upset / Food poisoning', 'Gastroenterology'),
('Acid Reflux / GERD', 'Gastroenterology'),
('Bloody Stool', 'Gastroenterology'),
-- Neurology
('Dizziness / Vertigo', 'Neurology'),
('Headache / Migraine', 'Neurology'),
('Numbness / Tingling', 'Neurology'),
('Seizures / Fits', 'Neurology'),
('Stroke Symptoms', 'Neurology'),
('Tremors / Shaking', 'Neurology'),
('Loss of Balance', 'Neurology'),
('Confusion / Memory Issues', 'Neurology'),
('Nerve Pain / Neuropathy', 'Neurology'),
-- Orthopedics
('Back Pain', 'Orthopedics'),
('Fracture / Injury', 'Orthopedics'),
('Joint Pain / Arthritis', 'Orthopedics'),
('Stress Injury / Sprain', 'Orthopedics'),
('Knee pain', 'Orthopedics'),
('Shoulder pain', 'Orthopedics'),
('Neck pain', 'Orthopedics'),
('Hip pain', 'Orthopedics'),
('Broken Bone / Fracture', 'Orthopedics'),
('Muscle Strain / Sprain', 'Orthopedics'),
('Slip Disc', 'Orthopedics'),
-- Dermatology
('Skin Infection / Rash', 'Dermatology'),
('Acne / Pimples', 'Dermatology'),
('Eczema / Dry Skin', 'Dermatology'),
('Hives / Itchy Skin', 'Dermatology'),
('Mole Check', 'Dermatology'),
('Psoriasis', 'Dermatology'),
('Blisters', 'Dermatology'),
('Warts', 'Dermatology'),
('Hair Loss', 'Dermatology'),
('Dandruff', 'Dermatology'),
('Fungal Infection / Ringworm', 'Dermatology'),
-- Psychiatry
('Anxiety Disorder', 'Psychiatry'),
('Depression', 'Psychiatry'),
('Mental Stress / Insomnia', 'Psychiatry'),
('Panic Attacks', 'Psychiatry'),
('Mood Swings', 'Psychiatry'),
('Sleep Disorder / Insomnia', 'Psychiatry'),
('OCD Symptoms', 'Psychiatry'),
('ADHD / Focus issues', 'Psychiatry'),
-- ENT
('Ear Pain / Hearing Issue', 'ENT'),
('Sore Throat / Tonsillitis', 'ENT'),
('Ringing in ears / Tinnitus', 'ENT'),
('Runny nose / Sinus congestion', 'ENT'),
('Sinusitis', 'ENT'),
('Throat Infection', 'ENT'),
('Nosebleed', 'ENT'),
-- Ophthalmology
('Eye Irritation / Vision Problem', 'Ophthalmology'),
('Vision Loss / Eye Disease', 'Ophthalmology'),
('Blurry vision', 'Ophthalmology'),
('Double vision', 'Ophthalmology'),
('Dry eyes / Itchy eyes', 'Ophthalmology'),
('Pink Eye / Conjunctivitis', 'Ophthalmology'),
-- Endocrinology
('Diabetes', 'Endocrinology'),
('Menstrual / Hormonal Issues', 'Endocrinology'),
('Obesity / Weight Issues', 'Endocrinology'),
('Thyroid Disorder', 'Endocrinology'),
('High Blood Sugar / Diabetes', 'Endocrinology'),
('Hormonal Imbalance', 'Endocrinology'),
('Metabolism issues', 'Endocrinology'),
-- Nephrology
('Kidney / Urinary Issue', 'Nephrology'),
('Urinary Tract Infection', 'Nephrology'),
('Kidney Stone', 'Nephrology'),
('Blood in urine / Hematuria', 'Nephrology'),
('Painful urination', 'Nephrology'),
('Swollen ankles / Edema', 'Nephrology'),
-- Dentistry
('Toothache / Dental Issue', 'Dentistry'),
('Bleeding Gums / Gum Pain', 'Dentistry'),
('Cavity / Tooth Decay', 'Dentistry'),
('Wisdom Tooth pain', 'Dentistry'),
('Mouth Ulcer', 'Dentistry');

-- ===============================
-- MAP USERS → DOCTORS
-- ===============================
INSERT INTO Doctors (user_id, department, specialty)
SELECT id, 
       CASE 
         WHEN identifier LIKE 'GP%' THEN 'General Medicine'
         WHEN identifier LIKE 'CARD%' THEN 'Cardiology'
         WHEN identifier LIKE 'PUL%' THEN 'Pulmonology'
         WHEN identifier LIKE 'GAS%' THEN 'Gastroenterology'
         WHEN identifier LIKE 'NEU%' THEN 'Neurology'
         WHEN identifier LIKE 'ORT%' THEN 'Orthopedics'
         WHEN identifier LIKE 'DER%' THEN 'Dermatology'
         WHEN identifier LIKE 'PSY%' THEN 'Psychiatry'
         WHEN identifier LIKE 'ENT%' THEN 'ENT'
         WHEN identifier LIKE 'EYE%' THEN 'Ophthalmology'
         WHEN identifier LIKE 'END%' THEN 'Endocrinology'
         WHEN identifier LIKE 'NEPH%' THEN 'Nephrology'
         WHEN identifier LIKE 'DEN%' THEN 'Dentistry'
       END,
       identifier
FROM Users
WHERE role = 'doctor';

-- ===============================
-- PERFORMANCE INDEXES
-- ===============================
CREATE INDEX idx_appointments_patient ON Appointments(patient_id);
CREATE INDEX idx_appointments_doctor_date ON Appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_status ON Appointments(status);
CREATE INDEX idx_doctors_user ON Doctors(user_id);
CREATE INDEX idx_medical_records_appointment ON MedicalRecords(appointment_id);
CREATE INDEX idx_prescriptions_record ON Prescriptions(record_id);
CREATE INDEX idx_symptoms_department ON Symptoms(department);

-- One live booking per doctor and slot. This, not an application-side check,
-- is what stops two simultaneous requests from taking the same slot.
CREATE UNIQUE INDEX uniq_active_slot
    ON Appointments(doctor_id, appointment_date, appointment_time)
    WHERE status <> 'Cancelled';

CREATE INDEX idx_days_off_doctor ON DoctorDaysOff(doctor_id, start_date, end_date);
CREATE INDEX idx_audit_user ON AuditLog(user_id, created_at);