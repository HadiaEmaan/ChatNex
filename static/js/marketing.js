const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.main-nav');
if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
        nav.classList.toggle('mobile-open');
    });
}

const userName = localStorage.getItem('chatnex_user');
const primaryCta = document.querySelector('.hero-actions .button:not(.button-ghost)');
if (primaryCta) {
    primaryCta.href = userName ? '/chatbot' : '/login';
}

if (userName) {
    document.querySelectorAll('.header-actions').forEach((actions) => {
        const greeting = document.createElement('span');
        greeting.className = 'user-greeting';
        greeting.textContent = userName;

        const logout = document.createElement('button');
        logout.className = 'logout-button';
        logout.type = 'button';
        logout.textContent = 'Logout';
        logout.addEventListener('click', async () => {
            localStorage.removeItem('chatnex_user');
            localStorage.removeItem('chatnex_role');
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/';
        });

        actions.replaceChildren(greeting, logout);
    });

    if (primaryCta) {
        primaryCta.href = '/chatbot';
        primaryCta.textContent = 'Start Now';
    }

    const pricingCta = document.querySelector('.cta-section .button');
    if (pricingCta) {
        pricingCta.href = '/chatbot';
        pricingCta.textContent = 'Open Workspace';
    }
}
