// ─── Dark Mode ────────────────────────────────────────────────────────────────

(function () {
    const btn = document.getElementById('btnDarkMode');
    const STORAGE_KEY = 'darkMode';

    function applyDark(on) {
        document.body.classList.toggle('dark', on);
        btn.textContent = on ? '☀️' : '🌙';
        btn.title = on ? 'Modo claro' : 'Modo escuro';
    }

    // Restaurar estado salvo (dark mode é o padrão)
    const saved = localStorage.getItem(STORAGE_KEY);
    applyDark(saved === null ? true : saved === 'true');
    document.documentElement.classList.remove('dark-pre');

    btn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark');
        localStorage.setItem(STORAGE_KEY, isDark);
        btn.textContent = isDark ? '☀️' : '🌙';
        btn.title = isDark ? 'Modo claro' : 'Modo escuro';
    });
})();
