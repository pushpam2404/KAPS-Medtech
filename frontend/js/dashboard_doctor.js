// Doctor dashboard: the booked queue and the treatment form.

document.addEventListener('DOMContentLoaded', () => {
    if (!App.checkAuth(['doctor'])) return;

    const $ = (id) => document.getElementById(id);
    const { esc, icon, formatDate } = App;

    const name = App.state.user.name || '';
    $('welcome-msg').textContent = /^Dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
    $('role-badge').textContent = 'doctor';

    const MAX_FILE = 2 * 1024 * 1024;

    // ---------- Queue ----------

    async function loadQueue() {
        const box = $('appointments-list');
        box.innerHTML = '<div class="skeleton" aria-hidden="true"></div><div class="skeleton" aria-hidden="true"></div>';
        const data = await App.load('/doctor/queue');
        if (!data) { box.innerHTML = ''; return; }
        if (!data.length) {
            box.innerHTML = `<div class="empty">${icon('check')}<h3>The queue is empty</h3><p>Booked appointments appear here as patients make them.</p></div>`;
            return;
        }

        const byDay = new Map();
        for (const a of data) {
            if (!byDay.has(a.appointment_date)) byDay.set(a.appointment_date, []);
            byDay.get(a.appointment_date).push(a);
        }

        box.innerHTML = [...byDay].map(([day, rows]) => `
            <section class="queue-day" aria-label="${esc(formatDate(day))}">
                <h2>${esc(formatDate(day))}${day === App.todayISO() ? ' (today)' : ''}</h2>
                <ul class="stack">
                    ${rows.map((a) => `
                    <li class="queue-row">
                        <span class="queue-time">${esc(a.appointment_time)}</span>
                        <div>
                            <p class="row-title">${esc(a.patient_name)}</p>
                            <p class="queue-reason">Reason: ${esc(a.symptom_description || 'Not given')}</p>
                        </div>
                        <div class="queue-actions">
                            <button type="button" class="btn btn-primary btn-sm start-btn" data-apt-id="${a.id}" data-patient-id="${a.patient_id}" data-patient-name="${esc(a.patient_name)}">Start visit</button>
                            <button type="button" class="btn btn-danger btn-sm cancel-btn" data-apt-id="${a.id}" data-patient-name="${esc(a.patient_name)}">Cancel</button>
                        </div>
                    </li>`).join('')}
                </ul>
            </section>`).join('');
    }

    $('appointments-list').addEventListener('click', (e) => {
        const start = e.target.closest('.start-btn');
        const cancel = e.target.closest('.cancel-btn');
        if (start) startTreatment(Number(start.dataset.aptId), Number(start.dataset.patientId), start.dataset.patientName, start);
        if (cancel) cancelAppointment(Number(cancel.dataset.aptId), cancel.dataset.patientName);
    });

    async function cancelAppointment(id, patient) {
        const ok = await App.confirm(`Cancel the appointment with ${patient}? They will need to book again.`, {
            confirmLabel: 'Cancel appointment', danger: true,
        });
        if (!ok) return;
        try {
            await App.api('/doctor/cancel', 'POST', { appointment_id: id });
            App.showToast('Appointment cancelled.', 'success');
            loadQueue();
        } catch (err) {
            App.showToast(err.error || 'Could not cancel the appointment.', 'error');
        }
    }

    // ---------- Treatment dialog ----------

    const modal = $('treatment-modal');
    App.closeOnBackdrop(modal);
    $('modal-close-btn').addEventListener('click', () => modal.close());

    function addMedRow() {
        const row = document.createElement('div');
        row.className = 'med-row';
        const n = $('med-rows').children.length + 1;
        const field = (cls, label, max) => `
            <div class="field"><label>${label}<input type="text" class="input ${cls}" maxlength="${max}"></label></div>`;
        row.innerHTML = `
            ${field('med-name', `Medicine ${n}`, 100)}
            ${field('med-dose', 'Dose', 50)}
            ${field('med-freq', 'How often', 50)}
            ${field('med-dur', 'For how long', 50)}
            <button type="button" class="icon-btn med-remove" aria-label="Remove medicine ${n}"></button>`;
        row.querySelector('.med-remove').insertAdjacentHTML('afterbegin', icon('x'));
        row.querySelector('.med-remove').addEventListener('click', () => {
            if ($('med-rows').children.length > 1) row.remove();
        });
        $('med-rows').appendChild(row);
    }
    $('add-med-btn').addEventListener('click', () => {
        addMedRow();
        $('med-rows').lastElementChild.querySelector('input').focus();
    });

    async function startTreatment(aptId, patientId, patientName, opener) {
        const data = await App.load(`/doctor/patient/${patientId}`);
        if (!data) return;

        $('apt-id').value = aptId;
        $('p-name').textContent = patientName;
        $('p-details').textContent = `Phone ${data.patient.phone || 'not on file'}. ID ${data.patient.identifier || 'not on file'}.`;
        $('p-history').innerHTML = data.history.length
            ? data.history.map((h) => `
                <div class="history-item">
                    <p class="date">${esc(formatDate(h.appointment_date))}</p>
                    <p class="dx">${esc(h.diagnosis)}</p>
                    <p class="adv">${esc(h.advice || 'No advice recorded.')}</p>
                </div>`).join('')
            : '<p class="hint">No earlier visits on record.</p>';

        $('treatment-form').reset();
        $('treatment-error').hidden = true;
        $('diagnosis').removeAttribute('aria-invalid');
        $('follow-up').min = App.todayISO();
        $('med-rows').replaceChildren();
        addMedRow();

        modal.showModal();
        modal.addEventListener('close', () => opener.isConnected && opener.focus(), { once: true });
    }

    const toDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

    function formError(message, field) {
        const el = $('treatment-error');
        el.textContent = message;
        el.hidden = false;
        if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
        else el.scrollIntoView({ block: 'nearest' });
    }

    $('treatment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        $('treatment-error').hidden = true;
        $('diagnosis').removeAttribute('aria-invalid');

        const diagnosis = $('diagnosis').value.trim();
        if (!diagnosis) return formError('Enter a diagnosis.', $('diagnosis'));

        let attached = null;
        const file = $('attached-reports').files[0];
        if (file) {
            if (file.size > MAX_FILE) return formError('That file is over 2 MB. Choose a smaller one.', $('attached-reports'));
            try { attached = await toDataUrl(file); } catch { return formError('The file could not be read.', $('attached-reports')); }
        }

        const prescriptions = [...document.querySelectorAll('#med-rows .med-row')]
            .map((row) => ({
                name: row.querySelector('.med-name').value.trim(),
                dosage: row.querySelector('.med-dose').value.trim(),
                freq: row.querySelector('.med-freq').value.trim(),
                duration: row.querySelector('.med-dur').value.trim(),
            }))
            .filter((p) => p.name);

        const btn = e.target.querySelector('[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Saving...';
        try {
            await App.api('/doctor/record', 'POST', {
                appointment_id: Number($('apt-id').value),
                diagnosis,
                advice: $('advice').value,
                attached_reports: attached,
                follow_up_date: $('follow-up').value || null,
                prescriptions,
                patient_updates: { phone: $('update-phone').value, identifier: $('update-id').value },
            });
            modal.close();
            App.showToast('Visit saved and marked complete.', 'success');
            loadQueue();
        } catch (err) {
            formError(err.error || 'Could not save the visit. Try again.');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Save and complete visit';
        }
    });

    loadQueue();
});
