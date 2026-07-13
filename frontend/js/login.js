// frontend/js/login.js — Login/Signup page logic

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    // Use proper event handling instead of implicit event global
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        if (
            (tab === 'login' && btn.textContent.trim() === 'Login') ||
            (tab === 'signup' && btn.textContent.trim() === 'Sign Up')
        ) {
            btn.classList.add('active');
        }
    });

    if (tab === 'login') {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('signup-form').classList.add('hidden');
    } else {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('signup-form').classList.remove('hidden');
    }
}

function selectRole(role) {
    document.querySelectorAll('.role-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`role-${role}`).classList.add('active');
    document.getElementById('s-role').value = role;

    if (role === 'doctor') {
        document.getElementById('doctor-fields').classList.remove('hidden');
    } else {
        document.getElementById('doctor-fields').classList.add('hidden');
    }
}



document.addEventListener('DOMContentLoaded', () => {
    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.textContent.trim() === 'Login' ? 'login' : 'signup';
            switchTab(tab);
        });
    });

    // Role cards
    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', () => {
            const role = card.id.replace('role-', '');
            selectRole(role);
        });
    });

    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('l-email').value;
        const password = document.getElementById('l-password').value;
        const btn = e.target.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.textContent = 'Signing in...';

        try {
            const res = await App.api('/auth/login', 'POST', { email, password });
            if (res) App.login(res.token, res.role, { name: res.name, id: res.id });
        } catch (err) {
            App.showToast(err.error || 'Login failed', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Access Account →';
        }
    });

    // Signup form
    document.getElementById('signup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('s-name').value;
        const email = document.getElementById('s-email').value;
        const password = document.getElementById('s-password').value;
        const role = document.getElementById('s-role').value;

        let payload = { name, email, password, role };

        if (role === 'doctor') {
            payload.department = document.getElementById('s-dept').value;
            payload.specialty = document.getElementById('s-specialty').value;
        }

        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Creating account...';

        try {
            await App.api('/auth/signup', 'POST', payload);
            App.showToast('Account created! Please login.', 'success');
            switchTab('login');
        } catch (err) {
            App.showToast(err.error || 'Signup failed', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account →';
        }
    });
});
