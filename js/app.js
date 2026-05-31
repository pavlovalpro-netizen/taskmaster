import { UI } from './ui.js';
import { TasksModule } from './modules/tasks.js';
import { Matrix } from './modules/matrix.js';
import { Dict } from './modules/dict.js';
import { Builder } from './modules/builder.js';
import { Registry } from './modules/registry.js';
import { IncompleteModule } from './modules/incomplete.js';
import { UsersModule } from './modules/users.js';
import { store } from './store.js';
import { Auth } from './auth.js';
import { escapeHTML, toast, CustomDialog } from './utils.js';

export const appModules = {
  tasks: TasksModule,
  matrix: Matrix,
  incomplete: IncompleteModule,
  dict: Dict,
  builder: Builder,
  registry: Registry,
  users: UsersModule
};

document.addEventListener('DOMContentLoaded', () => {
  UI.initTheme();

  const loadingScreen  = document.getElementById('loading-screen');
  const loginScreen    = document.getElementById('login-screen');
  const mainHeader     = document.getElementById('main-header');
  const mainContent    = document.getElementById('main-content');
  const userInfo       = document.getElementById('user-info');
  const notifWrapper   = document.getElementById('notifications-wrapper');

  Auth.init(
    // onLogin
    async (user, role) => {
      loadingScreen.style.display  = 'none';
      loginScreen.style.display    = 'none';
      mainHeader.style.display     = 'flex';
      mainContent.style.display    = 'flex';

      const roleLabel = role === 'admin' ? 'Администратор' : 'Инженер';
      userInfo.textContent = `${user.displayName || user.email} (${roleLabel})`;

      // Показываем колокольчик всем
      notifWrapper.style.display = 'block';

      if (role === 'admin') {
        // Добавляем кнопку приглашения и кнопку управления пользователями
        const inviteBtn = document.createElement('button');
        inviteBtn.className = 'btn btn-sm';
        inviteBtn.textContent = '🔗 Пригласить инженера';
        inviteBtn.onclick = () => {
          const inviteUrl = window.location.origin + window.location.pathname + '?invite=true';
          navigator.clipboard.writeText(inviteUrl).then(() => {
            toast('Ссылка-приглашение скопирована!', 'success');
          });
        };
        userInfo.parentNode.insertBefore(inviteBtn, userInfo);

        // Строим nav с вкладкой Пользователи и Незавершённые
        UI.buildNav([
          { id: 'tasks',      label: '📝 Задачи' },
          { id: 'matrix',     label: '🏗 Матрица ИД' },
          { id: 'incomplete', label: '🔍 Незавершённые' },
          { id: 'dict',       label: '📚 Справочники' },
          { id: 'builder',    label: '⚙️ Конфигуратор' },
          { id: 'registry',   label: '📋 Реестр' },
          { id: 'users',      label: '👥 Пользователи' }
        ], appModules);
      } else {
        // Инженер — ограниченные вкладки
        UI.buildNav([
          { id: 'tasks',  label: '📝 Задачи' },
          { id: 'matrix', label: '🏗 Матрица ИД' }
        ], appModules);
      }

      store.initRealtime();

      store.on('tasksTodo', () => {
        if (document.getElementById('tab-tasks')?.classList.contains('active')) TasksModule.render();
      });
      store.on('matrix', () => {
        if (document.getElementById('tab-matrix')?.classList.contains('active')) Matrix.loadMatrix();
        if (document.getElementById('tab-incomplete')?.classList.contains('active')) IncompleteModule.render();
      });

      UI.switchTab('tasks', appModules);
    },
    // onLogout
    () => {
      loadingScreen.style.display = 'none';
      loginScreen.style.display   = 'flex';
      mainHeader.style.display    = 'none';
      mainContent.style.display   = 'none';
      if (store.unsubscribeStore) store.unsubscribeStore();
    },
    // onAuthChecked (Firebase инициализирован, показываем экран входа если не авторизован)
    () => {
      loadingScreen.style.display = 'none';
      if (!Auth.currentUser) loginScreen.style.display = 'flex';
    }
  );

  // ── Колокольчик ─────────────────────────────────────────────────
  document.getElementById('btn-notifications')?.addEventListener('click', () => {
    const uid = Auth.currentUser?.uid;
    const isAdmin = Auth.userRole === 'admin';

    // Получаем нужные логи
    let logs = [];
    if (isAdmin) {
      logs = [...(store.db.activityLog || [])].reverse();
    } else {
      logs = [...(store.db.userNotifications?.[uid] || [])].reverse();
    }

    // Помечаем как прочитанные (для инженера)
    if (!isAdmin && uid) {
      store.markNotificationsRead(uid);
    }
    if (isAdmin) {
      store.lastLogCount = store.db.activityLog ? store.db.activityLog.length : 0;
      const badge = document.getElementById('notif-badge');
      if (badge) badge.style.display = 'none';
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'task-modal-card';
    modal.style.width = '620px';
    modal.style.height = '75vh';

    let logsHtml = '<div style="text-align:center; padding:24px; color:var(--text-secondary);">Событий пока нет</div>';
    if (logs.length > 0) {
      logsHtml = logs.map(log => {
        const isAdminLog = !!log.userName; // Лог активности инженеров (видит Админ)
        const icon = isAdminLog ? '👤' : '🔔';
        const who = isAdminLog ? escapeHTML(log.userName) : 'Администратор';
        const action = escapeHTML(log.action || log.message || '');
        const task = escapeHTML(log.taskTitle || '');
        return `
        <div style="padding:12px 16px; border-bottom:1px solid var(--border); display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${icon} ${who}</strong>
            <span style="font-size:0.75rem; color:var(--text-secondary);">${new Date(log.date).toLocaleString()}</span>
          </div>
          <div><span style="color:var(--primary);">${action}</span> — <em>"${task}"</em></div>
        </div>`;
      }).join('');
    }

    modal.innerHTML = `
      <div class="task-modal-header" style="display:flex; justify-content:space-between; align-items:center; padding: 20px 28px;">
        <h2 style="margin:0; font-size: 1.3rem;">🔔 Лента активности</h2>
        <button class="btn btn-icon btn-close-notif">✕</button>
      </div>
      <div class="task-modal-body" style="padding:0; overflow-y:auto;">${logsHtml}</div>
      <div class="task-modal-footer" style="justify-content: flex-end;">
        ${isAdmin ? `<button class="btn btn-danger" id="btn-clear-logs">Очистить ленту</button>` : ''}
      </div>`;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    const closeModal = () => { overlay.remove(); modal.remove(); };
    overlay.onclick = closeModal;
    modal.querySelector('.btn-close-notif').onclick = closeModal;
    modal.querySelector('#btn-clear-logs')?.addEventListener('click', async () => {
      if (await CustomDialog.confirm('Очистить всю историю активности?')) { store.clearActivityLog(); closeModal(); }
    });
  });
});
