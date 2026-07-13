// frontend/js/dashboard_user.js — Student/Staff Dashboard Logic



function formatDate(str) {
    if (!str) return '';
    return new Date(str).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

document.addEventListener('DOMContentLoaded', () => {
    App.checkAuth();
    document.getElementById('welcome-msg').innerText = `Hello, ${App.state.user.name}`;

    const roleBadge = document.getElementById('role-badge');
    roleBadge.innerText = App.state.role.toUpperCase();
    if (App.state.role === 'staff') roleBadge.className = 'status-badge status-Warning';

    // --- Navigation ---
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.menu-item').forEach(x => x.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.view-section').forEach(x => x.classList.add('hidden'));
            document.getElementById(item.dataset.view).classList.remove('hidden');

            if (item.dataset.view === 'view-appointments') loadAppointments();
            if (item.dataset.view === 'view-records') loadRecords();
            if (item.dataset.view === 'view-medicine') loadMedicine();
            if (item.dataset.view === 'view-reminders') loadReminders();
        });
    });

    // --- Booking State ---
    let booking = { dept: '', reason: '', doctor: null, date: null, time: null };
    let suggestedDept = null;
    let debounceTimer = null;

    const specialtyDescriptions = {
        'General Medicine': 'General Practitioner / Family Health',
        'Cardiology': 'Heart Specialist / Cardiologist',
        'Pulmonology': 'Lung & Respiratory Specialist',
        'Gastroenterology': 'Digestive System Specialist',
        'Neurology': 'Brain & Nervous System Specialist',
        'Orthopedics': 'Bone & Joint Specialist / Orthopedics',
        'Dermatology': 'Skin Specialist / Dermatologist',
        'Psychiatry': 'Mental Health Specialist / Psychiatrist',
        'ENT': 'Ear, Nose & Throat Specialist',
        'Ophthalmology': 'Eye Specialist / Ophthalmologist',
        'Endocrinology': 'Hormone & Diabetes Specialist',
        'Nephrology': 'Kidney Specialist / Nephrologist',
        'Dentistry': 'Dental Care / Dentist'
    };

    const symptomInput = document.getElementById('symptom-input');
    const suggestionEl = document.getElementById('symptom-suggestion');

    symptomInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const text = symptomInput.value.trim();
        if (text.length < 3) {
            suggestionEl.classList.add('hidden');
            suggestedDept = null;
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const matches = await App.api(`/appointments/symptoms?q=${encodeURIComponent(text)}`);
                if (matches && matches.length > 0) {
                    const match = matches[0];
                    suggestedDept = match.department;
                    suggestionEl.innerHTML = `💡 Suggested Department: <strong style="color:var(--primary);">${suggestedDept}</strong> (based on "${match.name}")`;
                    suggestionEl.className = 'text-sm mt-2 status-badge status-Booked';
                    suggestionEl.classList.remove('hidden');
                    
                    // Visually highlight the matching department card
                    document.querySelectorAll('.dept-card').forEach(card => {
                        if (card.dataset.dept === suggestedDept) {
                            card.style.borderColor = 'var(--primary)';
                            card.style.boxShadow = '0 0 10px var(--primary-light)';
                        } else {
                            card.style.borderColor = '';
                            card.style.boxShadow = '';
                        }
                    });
                } else {
                    suggestionEl.classList.add('hidden');
                    suggestedDept = null;
                    document.querySelectorAll('.dept-card').forEach(card => {
                        card.style.borderColor = '';
                        card.style.boxShadow = '';
                    });
                }
            } catch (err) {
                console.error(err);
            }
        }, 300);
    });

    function backToStep(step) {
        document.getElementById('book-step-1').classList.add('hidden');
        document.getElementById('book-step-2').classList.add('hidden');
        document.getElementById('book-step-3').classList.add('hidden');
        document.getElementById(`book-step-${step}`).classList.remove('hidden');
    }

    // Back buttons
    document.getElementById('back-to-step-1').addEventListener('click', () => backToStep(1));
    document.getElementById('back-to-step-2').addEventListener('click', () => backToStep(2));

    // Department selection
    document.querySelectorAll('.dept-card').forEach(card => {
        card.addEventListener('click', async () => {
            const dept = card.dataset.dept;
            const reason = document.getElementById('symptom-input').value;
            if (!reason) {
                App.showToast('Please enter a reason first.', 'error');
                return;
            }

            // Warning validation on department mismatch
            if (suggestedDept && suggestedDept !== dept) {
                const proceed = confirm(`Warning: Your symptom description suggests the "${suggestedDept}" department.\n\nDo you want to proceed with "${dept}" anyway?`);
                if (!proceed) return;
            }

            booking.dept = dept;
            booking.reason = reason;
            document.getElementById('selected-dept').innerText = dept;

            const doctors = await App.api(`/appointments/doctors?department=${dept}`);
            const list = document.getElementById('doctors-list');
            if (!doctors || doctors.length === 0) {
                list.innerHTML = '<p class="text-muted">No doctors found in this department.</p>';
            } else {
                list.innerHTML = doctors.map(d => `
                    <button class="card card-interactive doctor-select-btn" data-doctor-id="${d.id}">
                        <h4 class="m-0">${d.name}</h4>
                        <small class="text-muted" style="margin-top: 4px; display: block; font-weight: 500;">${specialtyDescriptions[d.department] || d.specialty || d.department}</small>
                    </button>
                `).join('');

                list.querySelectorAll('.doctor-select-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        booking.doctor = parseInt(btn.dataset.doctorId);
                        const dateInput = document.getElementById('book-date');
                        dateInput.min = new Date().toISOString().split('T')[0];
                        dateInput.value = '';
                        document.getElementById('slots-container').innerHTML = '';
                        document.getElementById('confirm-book-btn').classList.add('hidden');
                        backToStep(3);
                    });
                });
            }

            backToStep(2);
        });
    });

    // Date change → load slots
    document.getElementById('book-date').addEventListener('change', async (e) => {
        const date = e.target.value;
        booking.date = date;
        const slots = await App.api(`/appointments/slots?doctor_id=${booking.doctor}&date=${date}`);
        const container = document.getElementById('slots-container');
        if (!slots || slots.length === 0) {
            container.innerHTML = '<p class="text-muted">No slots available for this date.</p>';
        } else {
            container.innerHTML = slots.map(t =>
                `<button class="slot" data-time="${t}">${t}</button>`
            ).join('');

            container.querySelectorAll('.slot').forEach(slot => {
                slot.addEventListener('click', () => {
                    container.querySelectorAll('.slot').forEach(x => x.classList.remove('selected'));
                    slot.classList.add('selected');
                    booking.time = slot.dataset.time;
                    document.getElementById('confirm-book-btn').classList.remove('hidden');
                });
            });
        }
    });

    // Confirm booking
    document.getElementById('confirm-book-btn').addEventListener('click', async () => {
        const btn = document.getElementById('confirm-book-btn');
        btn.disabled = true;
        btn.textContent = 'Booking...';

        try {
            await App.api('/appointments/book', 'POST', {
                doctor_id: booking.doctor, date: booking.date, time: booking.time, symptom: booking.reason
            });
            App.showToast('Appointment confirmed!', 'success');
            // Reset booking
            booking = { dept: '', reason: '', doctor: null, date: null, time: null };
            document.getElementById('symptom-input').value = '';
            backToStep(1);
        } catch (e) {
            App.showToast(e.error || 'Booking failed', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Confirm Booking';
        }
    });

    // --- My Appointments ---
    async function loadAppointments() {
        const start = document.getElementById('filter-start').value;
        const end = document.getElementById('filter-end').value;
        const reason = document.getElementById('filter-reason').value;

        const list = document.getElementById('appointments-list');
        list.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';

        const params = new URLSearchParams();
        // Make filters mutually exclusive
        if (start && end) {
            params.append('filter', 'date');
            params.append('start', start);
            params.append('end', end);
        } else if (reason) {
            params.append('filter', 'reason');
            params.append('q', reason);
        }

        const data = await App.api(`/appointments/my-appointments?${params.toString()}`);

        if (!data || data.length === 0) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No appointments found</h3>
                    <p class="text-muted">Book your first appointment from the sidebar.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = data.map(a => `
            <div class="card card-row">
                <div>
                    <div class="flex items-center gap-2">
                        <h4 class="m-0">${a.doctor_name}</h4>
                        <span class="text-muted text-sm">(${a.department})</span>
                    </div>
                    <p class="text-muted text-sm mt-1">${formatDate(a.appointment_date)} @ <span class="text-primary">${a.appointment_time.substring(0, 5)}</span></p>
                    <p class="text-xs text-muted">Reason: ${a.symptom_description || 'N/A'}</p>
                </div>
                <div class="flex-col items-end gap-2">
                    <span class="status-badge status-${a.status}">${a.status}</span>
                    ${a.status === 'Completed' ? `<button class="btn btn-primary btn-sm view-record-btn" data-apt-id="${a.id}">View Record</button>` : ''}
                </div>
            </div>
        `).join('');

        // Attach view record handlers
        list.querySelectorAll('.view-record-btn').forEach(btn => {
            btn.addEventListener('click', () => viewRecord(parseInt(btn.dataset.aptId)));
        });
    }

    // Filter buttons
    document.getElementById('filter-date-btn').addEventListener('click', loadAppointments);
    document.getElementById('filter-reason-btn').addEventListener('click', loadAppointments);

    // --- Records ---
    async function loadRecords() {
        const list = document.getElementById('records-list');
        list.innerHTML = '<div class="skeleton-card"></div>';
        const data = await App.api('/appointments/medical-records');
        if (!data || !data.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📄</div>
                    <h3>No medical records</h3>
                    <p class="text-muted">Records will appear here after doctor consultations.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = data.map(r => `
            <div class="card">
                 <p class="text-primary font-bold">${formatDate(r.appointment_date)} - ${r.doctor_name}</p>
                 <p><strong>Diagnosis:</strong> ${r.diagnosis}</p>
                 <p><strong>Advice:</strong> ${r.advice || '-'}</p>
                 ${r.attached_reports ? `<p><strong>Reports:</strong> Attached</p>` : ''}
                 <div class="prescription-box mt-2">
                    <strong>Prescriptions:</strong>
                    <ul class="prescription-list">
                        ${r.prescriptions ? r.prescriptions.map(p => `<li>${p.medicine} (${p.dosage}) - ${p.frequency} for ${p.duration}</li>`).join('') : '<li>None</li>'}
                    </ul>
                 </div>
            </div>
        `).join('');
    }

    async function viewRecord(aptId) {
        try {
            const record = await App.api(`/appointments/${aptId}/record`);
            const content = document.getElementById('record-modal-content');

            let prescriptionsHtml = '<li>None</li>';
            if (record.prescriptions && record.prescriptions.length > 0) {
                prescriptionsHtml = record.prescriptions.map(p =>
                    `<li>${p.medicine} (${p.dosage}) - ${p.frequency} for ${p.duration}</li>`
                ).join('');
            }

            content.innerHTML = `
                <h3 class="mb-4 text-primary">Medical Record</h3>
                <p><strong>Diagnosis:</strong> ${record.diagnosis}</p>
                <p><strong>Advice:</strong> ${record.advice || '-'}</p>
                ${record.attached_reports ?
                    (record.attached_reports.startsWith('data:image') ?
                        `<img src="${record.attached_reports}" style="max-width:100%; border-radius:8px; margin-top:10px;" alt="Medical report">` :
                        record.attached_reports.startsWith('data:application/pdf') ?
                            `<a href="${record.attached_reports}" download="report.pdf" class="btn btn-outline btn-sm mt-2">Download Report PDF</a>` :
                            `<p><strong>Reports:</strong> ${record.attached_reports}</p>`)
                    : ''}
                <div class="prescription-box mt-4">
                    <strong>Prescriptions:</strong>
                    <ul class="prescription-list">
                        ${prescriptionsHtml}
                    </ul>
                </div>
            `;
            document.getElementById('record-modal').classList.remove('hidden');
        } catch (e) {
            App.showToast('Record not found or error fetching details.', 'error');
        }
    }

    // Close modal
    document.getElementById('record-modal-close').addEventListener('click', () => {
        document.getElementById('record-modal').classList.add('hidden');
    });

    // --- Medicine ---
    async function loadMedicine() {
        const list = document.getElementById('medicine-list');
        list.innerHTML = '<div class="skeleton-card"></div>';
        const data = await App.api('/appointments/my-medicine');
        if (!data || !data.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💊</div>
                    <h3>No active medicines</h3>
                    <p class="text-muted">Prescriptions will appear here after consultations.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = data.map(m => `
            <div class="card text-center medicine-card">
                <h4 class="medicine-name">${m.medicine_name}</h4>
                <span class="status-badge status-Completed">${m.dosage}</span>
                <p class="text-muted text-sm mt-2">${m.frequency}</p>
                <small class="text-muted block mt-1">For ${m.duration}</small>
                <small class="text-muted block">by ${m.doctor_name}</small>
            </div>
        `).join('');
    }

    // --- Reminders ---
    async function loadReminders() {
        const list = document.getElementById('reminders-list');
        list.innerHTML = '<div class="skeleton-card"></div>';
        const data = await App.api('/appointments/reminders');
        if (!data || !data.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔔</div>
                    <h3>No upcoming reminders</h3>
                    <p class="text-muted">Follow-up reminders will appear here.</p>
                </div>
            `;
        } else {
            list.innerHTML = data.map(r => `
                <div class="card reminder-card">
                    <h4 class="reminder-date">${formatDate(r.follow_up_date)}</h4>
                    <p>Follow up with ${r.doctor_name}</p>
                    <p class="text-sm text-muted italic">"${r.advice || 'No specific advice'}"</p>
                </div>
            `).join('');
        }
    }
});
