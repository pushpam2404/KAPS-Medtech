// Student and staff dashboard.

document.addEventListener('DOMContentLoaded', () => {
    if (!App.checkAuth(['student', 'staff'])) return;

    document.getElementById('welcome-msg').textContent = App.state.user.name || '';
    document.getElementById('role-badge').textContent = App.state.role;

    const $ = (id) => document.getElementById(id);
    const { esc, icon, formatDate } = App;

    const SPECIALTY_NOTE = {
        'General Medicine': 'General practitioner',
        Cardiology: 'Heart specialist',
        Pulmonology: 'Lung and breathing specialist',
        Gastroenterology: 'Digestive system specialist',
        Neurology: 'Brain and nerve specialist',
        Orthopedics: 'Bone and joint specialist',
        Dermatology: 'Skin specialist',
        Psychiatry: 'Mental health specialist',
        ENT: 'Ear, nose and throat specialist',
        Ophthalmology: 'Eye specialist',
        Endocrinology: 'Hormone and diabetes specialist',
        Nephrology: 'Kidney specialist',
        Dentistry: 'Dentist',
    };

    const skeleton = '<li class="skeleton" aria-hidden="true"></li><li class="skeleton" aria-hidden="true"></li>';
    const empty = (iconName, title, text) => `
        <div class="empty">
            ${icon(iconName)}
            <h3>${esc(title)}</h3>
            <p>${esc(text)}</p>
        </div>`;

    // ---------- Navigation ----------

    const loaders = {
        'view-appointments': () => loadAppointments(),
        'view-records': () => loadRecords(),
        'view-medicine': () => loadMedicine(),
        'view-reminders': () => loadReminders(),
    };

    function showView(id) {
        document.querySelectorAll('.nav-item').forEach((n) => {
            if (n.dataset.view === id) n.setAttribute('aria-current', 'page');
            else n.removeAttribute('aria-current');
        });
        document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== id; });
        if (loaders[id]) loaders[id]();
    }
    document.querySelectorAll('.nav-item').forEach((item) => {
        item.addEventListener('click', () => showView(item.dataset.view));
    });

    // ---------- Booking ----------

    let booking = { dept: '', reason: '', doctor: null, doctorName: '', date: null, time: null };
    let doctorsById = new Map();
    const hoursText = (d) => `${App.formatDays(d.working_days)}, ${d.start_time} to ${d.end_time}`;
    let suggestedDept = null;
    let debounce;
    let suggestSeq = 0;

    function goToStep(step) {
        [1, 2, 3].forEach((n) => { $(`book-step-${n}`).hidden = n !== step; });
        document.querySelectorAll('.steps li').forEach((li) => {
            const n = Number(li.dataset.step);
            if (n === step) li.setAttribute('aria-current', 'step');
            else li.removeAttribute('aria-current');
            li.classList.toggle('done', n < step);
        });
    }

    // Fill the suggestion list from the symptom dictionary.
    App.load('/appointments/symptoms').then((rows) => {
        if (rows) $('symptoms-datalist').innerHTML = rows.map((r) => `<option value="${esc(r.name)}">`).join('');
    });

    function markSuggested(dept) {
        document.querySelectorAll('.dept').forEach((btn) => {
            const on = btn.dataset.dept === dept;
            btn.dataset.suggested = String(on);
            btn.querySelector('.dept-flag').hidden = !on;
        });
    }

    $('symptom-input').addEventListener('input', (e) => {
        clearTimeout(debounce);
        const text = e.target.value.trim();
        const box = $('symptom-suggestion');
        if (text.length < 3) {
            box.hidden = true;
            suggestedDept = null;
            markSuggested(null);
            return;
        }
        debounce = setTimeout(async () => {
            const seq = ++suggestSeq;
            const matches = await App.load(`/appointments/symptoms?q=${encodeURIComponent(text)}`);
            if (seq !== suggestSeq || !matches) return; // a newer keystroke won
            if (matches.length) {
                suggestedDept = matches[0].department;
                box.textContent = `Suggested department: ${suggestedDept}, from the symptom "${matches[0].name}". This is a keyword match, so pick a different department if it does not fit.`;
                box.hidden = false;
            } else {
                suggestedDept = null;
                box.hidden = true;
            }
            markSuggested(suggestedDept);
        }, 300);
    });

    $('back-to-step-1').addEventListener('click', () => goToStep(1));
    $('back-to-step-2').addEventListener('click', () => goToStep(2));

    document.querySelectorAll('.dept').forEach((card) => {
        card.addEventListener('click', async () => {
            const dept = card.dataset.dept;
            const reason = $('symptom-input').value.trim();
            if (!reason) {
                App.showToast('Describe the reason for the visit first.', 'error');
                $('symptom-input').focus();
                return;
            }
            if (suggestedDept && suggestedDept !== dept) {
                const go = await App.confirm(
                    `Your description points to ${suggestedDept}, but you chose ${dept}. Continue with ${dept}?`,
                    { confirmLabel: `Continue with ${dept}` }
                );
                if (!go) return;
            }

            booking = { dept, reason, doctor: null, doctorName: '', date: null, time: null };
            $('selected-dept').textContent = dept;

            const doctors = await App.load(`/appointments/doctors?department=${encodeURIComponent(dept)}`);
            if (!doctors) return;
            const list = $('doctors-list');
            doctorsById = new Map(doctors.map((d) => [d.id, d]));
            list.innerHTML = doctors.length
                ? doctors.map((d) => `
                    <li><button type="button" class="pick" data-doctor-id="${d.id}" data-name="${esc(d.name)}">
                        <span><span class="pick-name">${esc(d.name)}</span><span class="pick-sub">${esc(SPECIALTY_NOTE[d.department] || d.specialty || d.department)}</span><span class="pick-sub">Sees patients ${esc(hoursText(d))}</span></span>
                    </button></li>`).join('')
                : '<li class="hint">No doctors are listed in this department yet.</li>';
            goToStep(2);
            const first = list.querySelector('button');
            if (first) first.focus();
        });
    });

    $('doctors-list').addEventListener('click', (e) => {
        const btn = e.target.closest('.pick');
        if (!btn) return;
        booking.doctor = Number(btn.dataset.doctorId);
        booking.doctorName = btn.dataset.name;
        $('selected-doctor').textContent = booking.doctorName;
        const date = $('book-date');
        date.min = App.todayISO();
        date.value = '';
        $('slots-container').replaceChildren();
        $('confirm-book-btn').hidden = true;
        goToStep(3);
        date.focus();
    });

    // Say why a day has no times: the doctor does not work that weekday, or it is simply full or blocked.
    function emptyDayMessage(doc, date) {
        if (!doc) return 'No free times on this date. Try another day.';
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
        return doc.working_days.includes(weekday)
            ? 'No free times on this date. The day may be full or the doctor may be away. Try another day.'
            : `${doc.name} does not see patients on this weekday. Sees patients ${hoursText(doc)}.`;
    }

    $('book-date').addEventListener('change', async (e) => {
        booking.date = e.target.value;
        booking.time = null;
        $('confirm-book-btn').hidden = true;
        const box = $('slots-container');
        if (!booking.date) return box.replaceChildren();

        const slots = await App.load(`/appointments/slots?doctor_id=${booking.doctor}&date=${booking.date}`);
        if (!slots) return;
        box.innerHTML = slots.length
            ? slots.map((t) => `<button type="button" class="slot" aria-pressed="false" data-time="${esc(t)}">${esc(t)}</button>`).join('')
            : `<p class="hint">${esc(emptyDayMessage(doctorsById.get(booking.doctor), booking.date))}</p>`;
    });

    $('slots-container').addEventListener('click', (e) => {
        const slot = e.target.closest('.slot');
        if (!slot) return;
        $('slots-container').querySelectorAll('.slot').forEach((s) => s.setAttribute('aria-pressed', String(s === slot)));
        booking.time = slot.dataset.time;
        $('confirm-book-btn').hidden = false;
    });

    $('confirm-book-btn').addEventListener('click', async () => {
        const btn = $('confirm-book-btn');
        btn.disabled = true;
        btn.textContent = 'Booking...';
        try {
            await App.api('/appointments/book', 'POST', {
                doctor_id: booking.doctor, date: booking.date, time: booking.time, symptom: booking.reason,
            });
            App.showToast(`Booked with ${booking.doctorName} on ${formatDate(booking.date)} at ${booking.time}.`, 'success');
            $('symptom-input').value = '';
            $('symptom-suggestion').hidden = true;
            suggestedDept = null;
            markSuggested(null);
            goToStep(1);
            showView('view-appointments');
        } catch (err) {
            App.showToast(err.error || 'Booking failed', 'error');
            if (err.error && /already been booked/.test(err.error)) $('book-date').dispatchEvent(new Event('change'));
        } finally {
            btn.disabled = false;
            btn.textContent = 'Confirm booking';
        }
    });

    // ---------- Appointments ----------

    async function loadAppointments() {
        const list = $('appointments-list');
        list.innerHTML = skeleton;

        const start = $('filter-start').value;
        const end = $('filter-end').value;
        const reason = $('filter-reason').value.trim();
        const params = new URLSearchParams();
        let scope = 'Showing upcoming booked appointments. Use the filters to find completed or cancelled ones.';
        if (start && end) {
            params.set('filter', 'date'); params.set('start', start); params.set('end', end);
            scope = `Showing every appointment from ${formatDate(start)} to ${formatDate(end)}.`;
        } else if (reason) {
            params.set('filter', 'reason'); params.set('q', reason);
            scope = `Showing every appointment whose reason contains "${reason}".`;
        } else if (start || end) {
            scope += ' Set both dates to filter by date.';
        }
        $('appointments-scope').textContent = scope;

        const data = await App.load(`/appointments/my-appointments?${params}`);
        if (!data) { list.innerHTML = ''; return; }
        if (!data.length) {
            list.innerHTML = `<li>${empty('calendar', 'No appointments here', 'Book a visit from the first tab, or change the filters.')}</li>`;
            return;
        }

        list.innerHTML = data.map((a) => `
            <li class="row">
                <div class="row-main">
                    <p class="row-title">${esc(a.doctor_name)} <small>${esc(a.department)}</small></p>
                    <p class="row-meta"><strong>${esc(formatDate(a.appointment_date))}, ${esc(a.appointment_time)}</strong></p>
                    <p class="row-meta">Reason: ${esc(a.symptom_description || 'Not given')}</p>
                </div>
                <div class="row-side">
                    <span class="chip chip-${esc(a.status.toLowerCase())}">${esc(a.status)}</span>
                    ${a.status === 'Completed' ? `<button type="button" class="btn btn-primary btn-sm view-record-btn" data-apt-id="${a.id}">View record</button>` : ''}
                    ${a.status === 'Booked' ? `
                        <button type="button" class="btn btn-quiet btn-sm reschedule-btn" data-apt-id="${a.id}" data-doctor-id="${a.doctor_id}" data-doctor="${esc(a.doctor_name)}" data-when="${esc(`${formatDate(a.appointment_date)}, ${a.appointment_time}`)}">Reschedule</button>
                        <button type="button" class="btn btn-danger btn-sm cancel-apt-btn" data-apt-id="${a.id}" data-doctor="${esc(a.doctor_name)}" data-when="${esc(`${formatDate(a.appointment_date)}, ${a.appointment_time}`)}">Cancel</button>` : ''}
                </div>
            </li>`).join('');
    }

    $('appointments-list').addEventListener('click', async (e) => {
        const view = e.target.closest('.view-record-btn');
        const move = e.target.closest('.reschedule-btn');
        const cancel = e.target.closest('.cancel-apt-btn');
        if (view) viewRecord(Number(view.dataset.aptId), view);
        if (move) openReschedule(move);
        if (cancel) {
            const ok = await App.confirm(`Cancel your appointment with ${cancel.dataset.doctor} on ${cancel.dataset.when}? The time goes back to other patients.`, {
                confirmLabel: 'Cancel appointment', danger: true,
            });
            if (!ok) return;
            try {
                await App.api(`/appointments/${cancel.dataset.aptId}/cancel`, 'POST');
                App.showToast('Appointment cancelled.', 'success');
                loadAppointments();
            } catch (err) {
                App.showToast(err.error || 'Could not cancel the appointment.', 'error');
            }
        }
    });

    // ---------- Reschedule ----------

    const reModal = $('reschedule-modal');
    App.closeOnBackdrop(reModal);
    let re = null; // { id, doctorId, time, opener }

    function reError(message) {
        $('reschedule-error').textContent = message || '';
        $('reschedule-error').hidden = !message;
    }

    function openReschedule(btn) {
        re = { id: Number(btn.dataset.aptId), doctorId: Number(btn.dataset.doctorId), time: null, opener: btn };
        $('reschedule-summary').textContent = `${btn.dataset.doctor}, currently ${btn.dataset.when}. Pick a new date, then a time.`;
        const date = $('reschedule-date');
        date.min = App.todayISO();
        date.value = '';
        $('reschedule-slots').replaceChildren();
        $('reschedule-confirm').disabled = true;
        reError('');
        reModal.showModal();
        date.focus();
    }
    const closeReschedule = () => reModal.close();
    $('reschedule-close').addEventListener('click', closeReschedule);
    $('reschedule-cancel').addEventListener('click', closeReschedule);
    reModal.addEventListener('close', () => { if (re && re.opener.isConnected) re.opener.focus(); });

    $('reschedule-date').addEventListener('change', async (e) => {
        re.time = null;
        $('reschedule-confirm').disabled = true;
        reError('');
        const box = $('reschedule-slots');
        if (!e.target.value) return box.replaceChildren();
        const slots = await App.load(`/appointments/slots?doctor_id=${re.doctorId}&date=${e.target.value}`);
        if (!slots) return;
        box.innerHTML = slots.length
            ? slots.map((t) => `<button type="button" class="slot" aria-pressed="false" data-time="${esc(t)}">${esc(t)}</button>`).join('')
            : '<p class="hint">No free times on this date. The doctor may not work that day or may be away.</p>';
    });
    $('reschedule-slots').addEventListener('click', (e) => {
        const slot = e.target.closest('.slot');
        if (!slot) return;
        $('reschedule-slots').querySelectorAll('.slot').forEach((s) => s.setAttribute('aria-pressed', String(s === slot)));
        re.time = slot.dataset.time;
        $('reschedule-confirm').disabled = false;
    });
    $('reschedule-confirm').addEventListener('click', async () => {
        const btn = $('reschedule-confirm');
        btn.disabled = true;
        try {
            await App.api(`/appointments/${re.id}/reschedule`, 'PUT', { date: $('reschedule-date').value, time: re.time });
            reModal.close();
            App.showToast(`Moved to ${formatDate($('reschedule-date').value)} at ${re.time}.`, 'success');
            loadAppointments();
        } catch (err) {
            reError(err.error || 'Could not move the appointment.');
            btn.disabled = false;
            if (/already been booked/.test(err.error || '')) $('reschedule-date').dispatchEvent(new Event('change'));
        }
    });
    $('filter-form').addEventListener('submit', (e) => { e.preventDefault(); loadAppointments(); });
    $('filter-clear').addEventListener('click', () => {
        $('filter-form').reset();
        loadAppointments();
    });

    // ---------- Records ----------

    const prescriptionItems = (list) => (list && list.length
        ? list.map((p) => `<li><strong>${esc(p.medicine)}</strong>${p.dosage ? `, ${esc(p.dosage)}` : ''}${p.frequency ? `, ${esc(p.frequency)}` : ''}${p.duration ? ` for ${esc(p.duration)}` : ''}</li>`).join('')
        : '<li>None prescribed</li>');

    async function loadRecords() {
        const list = $('records-list');
        list.innerHTML = skeleton;
        const data = await App.load('/appointments/medical-records');
        if (!data) { list.innerHTML = ''; return; }
        if (!data.length) {
            list.innerHTML = empty('file', 'No records yet', 'A record appears here after a doctor completes your visit.');
            return;
        }
        list.innerHTML = data.map((r) => `
            <article class="record">
                <div class="record-head">
                    <p class="record-date">${esc(formatDate(r.appointment_date))}</p>
                    <p class="hint">${esc(r.doctor_name)}</p>
                </div>
                <dl class="facts">
                    <dt>Diagnosis</dt><dd>${esc(r.diagnosis)}</dd>
                    <dt>Advice</dt><dd>${esc(r.advice || 'None recorded')}</dd>
                    ${r.attached_reports ? '<dt>Report</dt><dd>Attached. Open the visit under Appointments to view it.</dd>' : ''}
                </dl>
                <div class="rx"><h4>Prescriptions</h4><ul>${prescriptionItems(r.prescriptions)}</ul></div>
            </article>`).join('');
    }

    const IMAGE_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
    const PDF_URL = /^data:application\/pdf;base64,[A-Za-z0-9+/]+={0,2}$/;

    function reportHtml(value) {
        if (!value) return '';
        if (IMAGE_URL.test(value)) return `<img class="report-img" src="${value}" alt="Report attached by your doctor">`;
        if (PDF_URL.test(value)) return `<p><a class="btn btn-quiet btn-sm" href="${value}" download="report.pdf">Download report (PDF)</a></p>`;
        return '<p class="hint">A report is attached in a format this page cannot show.</p>';
    }

    const recordModal = $('record-modal');
    App.closeOnBackdrop(recordModal);
    $('record-modal-close').addEventListener('click', () => recordModal.close());

    async function viewRecord(aptId, opener) {
        const rec = await App.load(`/appointments/${aptId}/record`);
        if (!rec) return;
        $('record-modal-content').innerHTML = `
            <dl class="facts">
                <dt>Diagnosis</dt><dd>${esc(rec.diagnosis)}</dd>
                <dt>Advice</dt><dd>${esc(rec.advice || 'None recorded')}</dd>
                ${rec.follow_up_date ? `<dt>Follow-up</dt><dd>${esc(formatDate(rec.follow_up_date))}</dd>` : ''}
            </dl>
            <div class="rx"><h4>Prescriptions</h4><ul>${prescriptionItems(rec.prescriptions)}</ul></div>
            ${reportHtml(rec.attached_reports)}`;
        recordModal.showModal();
        recordModal.addEventListener('close', () => opener.focus(), { once: true });
    }

    // ---------- Medicine ----------

    async function loadMedicine() {
        const list = $('medicine-list');
        list.innerHTML = skeleton;
        const data = await App.load('/appointments/my-medicine');
        if (!data) { list.innerHTML = ''; return; }
        if (!data.length) {
            list.innerHTML = `<li>${empty('pill', 'No active medicines', 'Prescriptions from your visits show up here while they are still running.')}</li>`;
            return;
        }
        list.innerHTML = data.map((m) => `
            <li class="rx-label">
                <h3>${esc(m.medicine_name)}</h3>
                <p class="rx-dose">${esc(m.dosage || '-')}</p>
                <p>${esc(m.frequency || '')}${m.duration ? `, for ${esc(m.duration)}` : ''}</p>
                <p>Prescribed by ${esc(m.doctor_name)} on ${esc(formatDate(m.appointment_date))}</p>
            </li>`).join('');
    }

    // ---------- Follow-ups ----------

    async function loadReminders() {
        const list = $('reminders-list');
        list.innerHTML = skeleton;
        const data = await App.load('/appointments/reminders');
        if (!data) { list.innerHTML = ''; return; }
        if (!data.length) {
            list.innerHTML = `<li>${empty('bell', 'No follow-ups scheduled', 'If a doctor asks you to come back, the date appears here.')}</li>`;
            return;
        }
        list.innerHTML = data.map((r) => `
            <li class="row">
                <div class="row-main">
                    <p class="followup-date">${esc(formatDate(r.follow_up_date))}</p>
                    <p class="row-title">Follow up with ${esc(r.doctor_name)}</p>
                    <p class="row-meta">${esc(r.advice || 'No advice recorded.')}</p>
                </div>
            </li>`).join('');
    }
});
