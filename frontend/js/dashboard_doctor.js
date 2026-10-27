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

    // ---------- Tabs ----------

    const tabs = [$('tab-queue'), $('tab-schedule')];
    const panels = [$('panel-queue'), $('panel-schedule')];
    let scheduleLoaded = false;

    function selectTab(i, focus = false) {
        tabs.forEach((t, n) => {
            t.setAttribute('aria-selected', String(n === i));
            t.tabIndex = n === i ? 0 : -1;
            panels[n].hidden = n !== i;
        });
        if (focus) tabs[i].focus();
        if (i === 1 && !scheduleLoaded) { scheduleLoaded = true; loadSchedule(); }
    }
    tabs.forEach((t, i) => {
        t.addEventListener('click', () => selectTab(i));
        t.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); selectTab(1 - i, true); }
        });
    });

    // ---------- Availability ----------

    const halfHours = [];
    for (let m = 6 * 60; m <= 22 * 60; m += 30) {
        halfHours.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
    }
    $('hours-start').innerHTML = halfHours.slice(0, -1).map((t) => `<option>${t}</option>`).join('');
    $('hours-end').innerHTML = halfHours.slice(1).map((t) => `<option>${t}</option>`).join('');

    function setError(id, message) {
        $(id).textContent = message || '';
        $(id).hidden = !message;
    }

    function renderSchedule(a) {
        $('hours-start').value = a.start_time;
        $('hours-end').value = a.end_time;
        document.querySelectorAll('#hours-form input[name="day"]').forEach((box) => {
            box.checked = a.working_days.includes(Number(box.value));
        });
        const list = $('days-off-list');
        list.innerHTML = a.days_off.length
            ? a.days_off.map((o) => `
                <li class="off-item">
                    <div>
                        <p class="row-title">${esc(formatDate(o.start_date))}${o.end_date !== o.start_date ? ` to ${esc(formatDate(o.end_date))}` : ''}</p>
                        <p class="row-meta">${esc(o.reason || 'No reason given')}</p>
                    </div>
                    <button type="button" class="btn btn-quiet btn-sm off-remove" data-id="${o.id}">Remove</button>
                </li>`).join('')
            : '<li class="hint">No days off planned.</li>';
    }

    async function loadSchedule() {
        const a = await App.load('/doctor/availability');
        if (a) renderSchedule(a);
        $('off-start').min = App.todayISO();
        $('off-end').min = App.todayISO();
    }

    $('hours-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setError('hours-error');
        const days = [...document.querySelectorAll('#hours-form input[name="day"]:checked')].map((b) => Number(b.value));
        if (!days.length) return setError('hours-error', 'Choose at least one working day.');
        const start = $('hours-start').value;
        const end = $('hours-end').value;
        if (end <= start) return setError('hours-error', 'The last slot must end after the first one starts.');

        const btn = e.target.querySelector('[type="submit"]');
        btn.disabled = true;
        try {
            const a = await App.api('/doctor/availability', 'PUT', { start_time: start, end_time: end, working_days: days });
            renderSchedule(a);
            App.showToast(a.outside_new_hours
                ? `Hours saved. ${a.outside_new_hours} booked appointment(s) fall outside them; cancel or keep them from the queue.`
                : 'Hours saved.', 'success');
        } catch (err) {
            setError('hours-error', err.error || 'Could not save the hours.');
        } finally {
            btn.disabled = false;
        }
    });

    $('days-off-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        setError('days-off-error');
        const start = $('off-start').value;
        if (!start) return setError('days-off-error', 'Choose the first day off.');
        const end = $('off-end').value || start;
        if (end < start) return setError('days-off-error', 'The last day cannot be before the first.');
        try {
            const r = await App.api('/doctor/days-off', 'POST', { start_date: start, end_date: end, reason: $('off-reason').value });
            e.target.reset();
            renderSchedule(await App.api('/doctor/availability'));
            App.showToast(r.booked_in_range
                ? `Days off added. ${r.booked_in_range} booked appointment(s) fall in that range; cancel them from the queue if you will be away.`
                : 'Days off added.', r.booked_in_range ? 'info' : 'success');
        } catch (err) {
            setError('days-off-error', err.error || 'Could not add the days off.');
        }
    });

    $('days-off-list').addEventListener('click', async (e) => {
        const btn = e.target.closest('.off-remove');
        if (!btn) return;
        try {
            await App.api(`/doctor/days-off/${btn.dataset.id}`, 'DELETE');
            renderSchedule(await App.api('/doctor/availability'));
            App.showToast('Days off removed.', 'success');
        } catch (err) {
            App.showToast(err.error || 'Could not remove the days off.', 'error');
        }
    });
});
