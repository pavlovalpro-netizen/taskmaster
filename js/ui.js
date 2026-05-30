export const UI = {
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

  renderNav(active, onTabSwitch) {
    const tabs = ['tasks', 'matrix', 'dict', 'builder', 'registry'];
    const labels = ['📝 Задачи', '📊 Матрица', '📚 Справочники', '🔧 Конструктор', '📁 Реестр'];
    const navContainer = document.getElementById('nav-tabs');
    if (!navContainer) return;

    navContainer.innerHTML = tabs.map((t, i) =>
      `<button class="tab-btn ${t === active ? 'active' : ''}" data-tab="${t}">${labels[i]}</button>`
    ).join('');

    // Remove old listeners to avoid duplicates if re-rendered
    navContainer.replaceWith(navContainer.cloneNode(true));
    document.getElementById('nav-tabs').addEventListener('click', e => {
      if (e.target.classList.contains('tab-btn')) {
        onTabSwitch(e.target.dataset.tab);
      }
    });
  },

  switchTab(tabId, modules) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');
    
    this.renderNav(tabId, (newTabId) => this.switchTab(newTabId, modules));
    
    if (modules[tabId] && typeof modules[tabId].render === 'function') {
      modules[tabId].render();
    }
  }
};
