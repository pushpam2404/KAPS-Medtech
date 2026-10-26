// Shared client helpers: API calls, escaping, icons, toasts, dialogs.

const API_BASE = '/api';

const ICONS = {
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    'arrow-left': '<path d="m12 19-7-7 7-7M19 12H5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
};

const App = {
    state: {
        token: localStorage.getItem('token'),
        role: localStorage.getItem('role'),
        user: JSON.parse(localStorage.getItem('user') || '{}'),
    },

    // Escape text before it goes into an innerHTML template.
    esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, (c) => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    },

    icon(name) {
        return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
    },

    // Dates from the API are plain YYYY-MM-DD; format them without a timezone shift.
    formatDate(iso) {
        if (!iso) return '';
        const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    },

    todayISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    init() {
        document.querySelectorAll('[data-icon]').forEach((el) => {
            el.insertAdjacentHTML('afterbegin', App.icon(el.dataset.icon));
        });
        const logout = document.getElementById('logoutBtn');
        if (logout) logout.addEventListener('click', App.logout);
    },

    async api(endpoint, method = 'GET', body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (App.state.token) headers.Authorization = `Bearer ${App.state.token}`;

        let res;
        try {
            res = await fetch(`${API_BASE}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
        } catch {
            const err = { error: 'Cannot reach the server. Check your connection and try again.' };
            App.showToast(err.error, 'error');
            throw err;
        }

        let data = null;
        try { data = await res.json(); } catch { /* no body */ }

        if (res.status === 401 && App.state.token) {
            // The token expired or was rejected: back to sign in.
            App.logout();
            throw { error: 'Session expired' };
        }
        if (!res.ok) throw data || { error: `Request failed (${res.status})` };
        return data;
    },

    // Call and report failures as a toast. Returns null when the call failed.
    async load(endpoint) {
        try {
            return await App.api(endpoint);
        } catch (err) {
            App.showToast(err.error || 'Something went wrong', 'error');
            return null;
        }
    },

    showToast(message, type = 'info') {
        const region = document.getElementById('toast-region');
        if (!region) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        region.replaceChildren(toast);
        setTimeout(() => {
            toast.classList.add('leaving');
            setTimeout(() => toast.remove(), 250);
        }, 4500);
    },

    // Promise-based replacement for window.confirm().
    confirm(message, { confirmLabel = 'Confirm', danger = false } = {}) {
        return new Promise((resolve) => {
            const dlg = document.createElement('dialog');
            dlg.className = 'dialog';
            dlg.setAttribute('aria-label', 'Please confirm');
            dlg.innerHTML = `
                <div class="dialog-body">
                    <p class="confirm-text">${App.esc(message)}</p>
                    <div class="dialog-actions">
                        <button type="button" class="btn btn-quiet" data-answer="no">Cancel</button>
                        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-answer="yes">${App.esc(confirmLabel)}</button>
                    </div>
                </div>`;
            let answer = false;
            dlg.addEventListener('click', (e) => {
                const a = e.target.closest('[data-answer]');
                if (a) { answer = a.dataset.answer === 'yes'; dlg.close(); }
            });
            dlg.addEventListener('close', () => { dlg.remove(); resolve(answer); });
            document.body.appendChild(dlg);
            dlg.showModal();
            dlg.querySelector('[data-answer="no"]').focus();
        });
    },

    // Close a <dialog> when its backdrop is clicked.
    closeOnBackdrop(dlg) {
        dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    },

    login(token, role, user) {
        localStorage.setItem('token', token);
        localStorage.setItem('role', role);
        localStorage.setItem('user', JSON.stringify(user));
        window.location.href = role === 'doctor' ? 'dashboard_doctor.html' : 'dashboard_user.html';
    },

    logout() {
        ['token', 'role', 'user'].forEach((k) => localStorage.removeItem(k));
        window.location.href = 'index.html';
    },

    // Guard a dashboard page. `allowed` is a list of roles; others are sent to their own page.
    checkAuth(allowed) {
        let expired = false;
        try {
            const payload = JSON.parse(atob(App.state.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            expired = payload.exp * 1000 < Date.now();
        } catch {
            expired = true;
        }
        if (!App.state.token || expired) {
            App.logout();
            return false;
        }
        if (!allowed.includes(App.state.role)) {
            window.location.href = App.state.role === 'doctor' ? 'dashboard_doctor.html' : 'dashboard_user.html';
            return false;
        }
        return true;
    },
};

document.addEventListener('DOMContentLoaded', App.init);
