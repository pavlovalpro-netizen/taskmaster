export const UI = {
  _navItems: [],

  initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    themeToggle.onclick = () => {
      document.body.classList.toggle('dark');
      localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
    };
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark');
    }
  },

  // Строим навигацию по массиву { id, label }
  buildNav(items, modules) {
    this._navItems = items;
    const navContainer = document.getElementById('nav-tabs');
    if (!navContainer) return;
    navContainer.innerHTML = items.map(item =>
      `<button class="tab-btn" data-tab="${item.id}">${item.label}</button>`
    ).join('');

    navContainer.addEventListener('click', e => {
      if (e.target.classList.contains('tab-btn')) {
        this.switchTab(e.target.dataset.tab, modules);
      }
    });
  },

  switchTab(tabId, modules) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));

    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');

    if (modules[tabId] && typeof modules[tabId].render === 'function') {
      modules[tabId].render();
    }
  }
};
