// Sign-in and sign-up page.

const DEPARTMENTS = [
    'General Medicine', 'Cardiology', 'Pulmonology', 'Gastroenterology', 'Neurology', 'Orthopedics',
    'Dermatology', 'Psychiatry', 'ENT', 'Ophthalmology', 'Endocrinology', 'Nephrology', 'Dentistry',
];

document.addEventListener('DOMContentLoaded', () => {
    if (App.state.token) {
        window.location.replace(App.state.role === 'doctor' ? 'dashboard_doctor.html' : 'dashboard_user.html');
        return;
    }

    const tabs = [document.getElementById('tab-login'), document.getElementById('tab-signup')];
    const panels = [document.getElementById('login-form'), document.getElementById('signup-form')];

    function selectTab(index, focus = false) {
        tabs.forEach((tab, i) => {
            tab.setAttribute('aria-selected', String(i === index));
            tab.tabIndex = i === index ? 0 : -1;
            panels[i].hidden = i !== index;
        });
        if (focus) tabs[index].focus();
    }
    tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => selectTab(i));
        tab.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                selectTab(1 - i, true);
            }
        });
    });

    document.getElementById('s-dept').innerHTML = DEPARTMENTS.map((d) => `<option>${App.esc(d)}</option>`).join('');

    const doctorFields = document.getElementById('doctor-fields');
    document.querySelectorAll('input[name="role"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            doctorFields.hidden = radio.value !== 'doctor' || !radio.checked;
        });
    });

    function showError(id, message, field) {
        const el = document.getElementById(id);
        el.textContent = message;
        el.hidden = false;
        if (field) {
            field.setAttribute('aria-invalid', 'true');
            field.focus();
        }
    }
    function clearErrors(form) {
        form.querySelectorAll('.form-error').forEach((e) => { e.hidden = true; });
        form.querySelectorAll('[aria-invalid]').forEach((f) => f.removeAttribute('aria-invalid'));
    }

    async function submit(form, button, busyLabel, action) {
        const idle = button.textContent;
        button.disabled = true;
        button.textContent = busyLabel;
        try {
            await action();
        } finally {
            button.disabled = false;
            button.textContent = idle;
        }
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        clearErrors(form);
        const email = document.getElementById('l-email');
        const password = document.getElementById('l-password');
        if (!email.value.trim()) return showError('login-error', 'Enter your email address.', email);
        if (!password.value) return showError('login-error', 'Enter your password.', password);

        await submit(form, form.querySelector('[type="submit"]'), 'Signing in...', async () => {
            try {
                const res = await App.api('/auth/login', 'POST', { email: email.value, password: password.value });
                App.login(res.token, res.role, { name: res.name, id: res.id });
            } catch (err) {
                showError('login-error', err.error || 'Sign in failed. Try again.');
            }
        });
    });

    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        clearErrors(form);
        const role = form.querySelector('input[name="role"]:checked').value;
        const name = document.getElementById('s-name');
        const email = document.getElementById('s-email');
        const password = document.getElementById('s-password');

        if (!name.value.trim()) return showError('signup-error', 'Enter your full name.', name);
        if (!email.validity.valid || !email.value) return showError('signup-error', 'Enter a valid email address.', email);
        if (password.value.length < 8) return showError('signup-error', 'Use a password of at least 8 characters.', password);

        const payload = { name: name.value, email: email.value, password: password.value, role };
        if (role === 'doctor') {
            payload.department = document.getElementById('s-dept').value;
            payload.specialty = document.getElementById('s-specialty').value;
            payload.doctor_code = document.getElementById('s-code').value;
        }

        await submit(form, form.querySelector('[type="submit"]'), 'Creating account...', async () => {
            try {
                await App.api('/auth/signup', 'POST', payload);
                form.reset();
                doctorFields.hidden = true;
                selectTab(0, true);
                App.showToast('Account created. Sign in to continue.', 'success');
            } catch (err) {
                showError('signup-error', err.error || 'Could not create the account. Try again.');
            }
        });
    });
});
