// frontend/js/dashboard_doctor.js — Doctor Dashboard Logic



document.addEventListener('DOMContentLoaded', () => {
    App.checkAuth();
    // Fix duplicate Dr. title
    const niceName = App.state.user.name.startsWith('Dr.') ? App.state.user.name : `Dr. ${App.state.user.name}`;
    document.getElementById('welcome-msg').innerText = niceName;

    // --- Load Appointments ---
    async function loadAppointments() {
        const list = document.getElementById('appointments-list');
        list.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';
        const data = await App.api('/doctor/today');

        if (!data || !data.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🩺</div>
                    <h3>No active appointments</h3>
                    <p class="text-muted">Enjoy your day, Doctor!</p>
                </div>
            `;
            return;
        }

        list.innerHTML = data.map(apt => `
            <div class="card card-row appointment-card">
                <div class="flex items-center gap-3">
                    <div class="time-badge">
                        <h3 class="m-0 text-primary">${apt.appointment_time.substring(0, 5)}</h3>
                    </div>
                    <div>
                        <h3 class="m-0 mb-1">${apt.patient_name}</h3>
                        <div class="flex items-center gap-2">
                            <span class="tag">Reason</span>
                            <span>${apt.symptom_description || 'Not specified'}</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="btn btn-primary start-treatment-btn" 
                            data-apt-id="${apt.id}" data-patient-id="${apt.patient_id}" data-patient-name="${apt.patient_name}">
                        Start Treatment
                    </button>
                    <button class="btn btn-outline btn-danger cancel-apt-btn" data-apt-id="${apt.id}">
                        Cancel
                    </button>
                </div>
            </div>
        `).join('');

        // Attach event listeners
        list.querySelectorAll('.start-treatment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                startTreatment(
                    parseInt(btn.dataset.aptId),
                    parseInt(btn.dataset.patientId),
                    btn.dataset.patientName
                );
            });
        });

        list.querySelectorAll('.cancel-apt-btn').forEach(btn => {
            btn.addEventListener('click', () => cancelAppointment(parseInt(btn.dataset.aptId)));
        });
    }
    loadAppointments();

    // --- Cancel Appointment ---
    async function cancelAppointment(id) {
        if (!confirm('Are you sure you want to cancel this appointment?')) return;
        try {
            await App.api('/doctor/cancel', 'POST', { appointment_id: id });
            App.showToast('Appointment cancelled', 'success');
            loadAppointments();
        } catch (e) {
            App.showToast(e.error || 'Failed to cancel', 'error');
        }
    }

    // --- Treatment Modal ---
    async function startTreatment(aptId, patientId, patientName) {
        document.getElementById('treatment-modal').classList.remove('hidden');
        document.getElementById('apt-id').value = aptId;
        document.getElementById('p-name').innerText = patientName;

        // Fetch patient details
        const data = await App.api(`/doctor/patient/${patientId}`);
        document.getElementById('p-details').innerText = `Phone: ${data.patient.phone || 'N/A'} | ID: ${data.patient.identifier || 'N/A'}`;

        // History
        const histCtx = document.getElementById('p-history');
        if (!data.history || !data.history.length) {
            histCtx.innerHTML = '<p class="text-muted text-sm italic">No prior medical history found.</p>';
        } else {
            histCtx.innerHTML = data.history.map(h => `
                <div class="history-item">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-xs text-primary font-bold">${new Date(h.appointment_date).toLocaleDateString()}</span>
                    </div>
                    <div class="font-bold text-sm mb-1">${h.diagnosis}</div>
                    <div class="text-xs text-muted">${h.advice || 'No specific advice recorded.'}</div>
                </div>
            `).join('');
        }

        // Clear Form
        document.getElementById('diagnosis').value = '';
        document.getElementById('advice').value = '';
        document.getElementById('attached-reports').value = '';
        document.getElementById('follow-up').value = '';
        document.getElementById('update-phone').value = '';
        document.getElementById('update-id').value = '';
        document.getElementById('med-rows').innerHTML = '';
        addMedRow();
    }

    function closeModal() {
        document.getElementById('treatment-modal').classList.add('hidden');
    }
    document.getElementById('modal-close-btn').addEventListener('click', closeModal);

    // --- Prescription Rows ---
    function addMedRow() {
        const div = document.createElement('div');
        div.className = 'med-row';
        div.innerHTML = `
            <input type="text" placeholder="Medicine Name" class="form-input med-name">
            <input type="text" placeholder="Dose" class="form-input med-dose">
            <input type="text" placeholder="Freq" class="form-input med-freq">
            <input type="text" placeholder="Days" class="form-input med-dur">
            <button type="button" class="btn btn-outline btn-sm med-remove-btn" title="Remove">×</button>
        `;
        div.querySelector('.med-remove-btn').addEventListener('click', () => {
            if (document.querySelectorAll('#med-rows .med-row').length > 1) {
                div.remove();
            }
        });
        document.getElementById('med-rows').appendChild(div);
    }
    document.getElementById('add-med-btn').addEventListener('click', addMedRow);

    // Base64 helper
    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    // --- Submit Treatment ---
    document.getElementById('treatment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const aptId = document.getElementById('apt-id').value;
        const diagnosis = document.getElementById('diagnosis').value;
        const advice = document.getElementById('advice').value;
        const followUp = document.getElementById('follow-up').value;

        // Handle Reports (File → Base64)
        let attached_reports = null;
        const fileInput = document.getElementById('attached-reports');
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                App.showToast('File is too large! Please upload a file smaller than 2MB.', 'error');
                return;
            }
            try {
                attached_reports = await toBase64(file);
            } catch (err) {
                App.showToast('Error processing file.', 'error');
                return;
            }
        }

        // Collect Meds
        const meds = [];
        document.querySelectorAll('#med-rows .med-row').forEach(row => {
            const name = row.querySelector('.med-name').value;
            if (name) {
                meds.push({
                    name,
                    dosage: row.querySelector('.med-dose').value,
                    freq: row.querySelector('.med-freq').value,
                    duration: row.querySelector('.med-dur').value
                });
            }
        });

        const updates = {
            phone: document.getElementById('update-phone').value,
            identifier: document.getElementById('update-id').value
        };

        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
            await App.api('/doctor/record', 'POST', {
                appointment_id: aptId,
                diagnosis,
                advice,
                attached_reports,
                follow_up_date: followUp || null,
                prescriptions: meds,
                patient_updates: updates
            });
            App.showToast('Treatment completed successfully!', 'success');
            closeModal();
            loadAppointments();
        } catch (e) {
            App.showToast(e.error || 'Failed to submit treatment.', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Complete Treatment →';
        }
    });
});
