document.addEventListener('DOMContentLoaded', () => {
    const googleButton = document.querySelector('.social-button');
    if (googleButton) googleButton.addEventListener('click', () => {
        window.location.href = '/auth/google';
    });

    document.querySelectorAll('input[type="email"]').forEach((emailInput) => {
        emailInput.style.backgroundImage = 'none';
        emailInput.style.appearance = 'none';
        emailInput.style.webkitAppearance = 'none';
    });

    const passwordInput = document.querySelector('#password');
    if (!passwordInput || passwordInput.parentElement.classList.contains('password-field')) return;

    const field = document.createElement('div');
    field.className = 'password-field';
    passwordInput.parentElement.insertBefore(field, passwordInput);
    field.appendChild(passwordInput);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'password-toggle';
    toggle.setAttribute('aria-label', 'Show password');
    toggle.textContent = 'Show';
    toggle.addEventListener('click', () => {
        const visible = passwordInput.type === 'text';
        passwordInput.type = visible ? 'password' : 'text';
        toggle.textContent = visible ? 'Show' : 'Hide';
        toggle.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
    });
    field.appendChild(toggle);
});

async function enterChat(event) {
    event.preventDefault();
    const firstName = document.querySelector('#first-name')?.value.trim();
    const lastName = document.querySelector('#last-name')?.value.trim() || '';
    const email = document.querySelector('#email')?.value.trim() || '';
    const password = document.querySelector('#password')?.value || '';
    const endpoint = firstName ? '/api/auth/signup' : '/api/auth/login';
    const payload = firstName
        ? { first_name: firstName, last_name: lastName, email, password }
        : { email, password };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok) {
            window.alert(result.error || 'Unable to continue. Please try again.');
            return false;
        }
        localStorage.setItem('chatnex_user', result.name || firstName || email.split('@')[0] || 'User');
        localStorage.setItem('chatnex_role', result.role || 'user');
        const next = result.next || new URLSearchParams(window.location.search).get('next');
        window.location.href = result.role === 'admin' ? '/admin' : (next || '/');
    } catch (error) {
        window.alert('Unable to connect to the server. Please try again.');
    }
    return false;
}
