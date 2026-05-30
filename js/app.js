import { UI } from './ui.js';
import { TasksModule } from './modules/tasks.js';
import { Matrix } from './modules/matrix.js';
import { Dict } from './modules/dict.js';
import { Builder } from './modules/builder.js';
import { Registry } from './modules/registry.js';
import { store } from './store.js';
import { Auth } from './auth.js';
import { escapeHTML, toast, CustomDialog } from './utils.js';

export const appModules = {
  tasks: TasksModule,
  matrix: Matrix,
  dict: Dict,
  builder: Builder,
  registry: Registry
};

document.addEventListener('DOMContentLoaded', () => {
  UI.initTheme();

  const loginScreen = document.getElementById('login-screen');
  const mainHeader = document.getElementById('main-header');
  const mainContent = document.getElementById('main-content');
  const userInfo = document.getElementById('user-info');
  const notifWrapper = document.getElementById('notifications-wrapper');

  Auth.init(
    (user, role) => {
      loginScreen.style.display = 'none';
      mainHeader.style.display = 'flex';
      mainContent.style.display = 'flex';
      
      const roleLabel = role === 'admin' ? 'Админ' : 'Инженер';
      userInfo.textContent = `${user.displayName || user.email} (${roleLabel})`;

      if (role === 'engineer') {
        document.querySelector('[data-tab="matrix"]')?.remove();
        document.querySelector('[data-tab="dict"]')?.remove();
        document.querySelector('[data-tab="builder"]')?.remove();
        document.querySelector('[data-tab="registry"]')?.remove();
        notifWrapper.style.display = 'none'; // Инженерам колокольчик не нужен
      } else {
        notifWrapper.style.display = 'block'; // Админу нужен колокольчик
        
        // Кнопка приглашения для админа
        const inviteBtn = document.createElement('button');
        inviteBtn.className = 'btn btn-sm';
        inviteBtn.textContent = '🔗 Пригласить инженера';
        inviteBtn.onclick = () => {
          const inviteUrl = window.location.origin + window.location.pathname + '?invite=true';
          navigator.clipboard.writeText(inviteUrl);
          toast('Ссылка-приглашение скопирована в буфер обмена!', 'success');
        };
        userInfo.parentNode.insertBefore(inviteBtn, userInfo);
      }

      store.initRealtime();

      store.on('tasksTodo', () => {
        if (document.getElementById('tab-tasks').classList.contains('active')) {
          TasksModule.render();
        }
      });
      store.on('matrix', () => {
        if (document.getElementById('tab-matrix').classList.contains('active')) {
          Matrix.loadMatrix();
        }
      });

      UI.switchTab('tasks', appModules);
    },
    () => {
      loginScreen.style.display = 'flex';
      mainHeader.style.display = 'none';
      mainContent.style.display = 'none';
      
      if (store.unsubscribeStore) {
        store.unsubscribeStore();
      }
    }
  );

  // Логика колокольчика (Лента активности)
  document.getElementById('btn-notifications')?.addEventListener('click', () => {
    const badge = document.getElementById('notif-badge');
    if (badge) badge.style.display = 'none'; // Сбрасываем бейджик при открытии
    
    // Сбрасываем счетчик в store, чтобы бейджик не появлялся сразу же
    store.lastLogCount = store.db.activityLog ? store.db.activityLog.length : 0;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'task-modal-card';
    modal.style.width = '600px';
    modal.style.height = '70vh';
    
    let logsHtml = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">Событий пока нет</div>';
    
    if (store.db.activityLog && store.db.activityLog.length > 0) {
      // Показываем самые свежие события сверху
      const sortedLogs = [...store.db.activityLog].reverse();
      
      logsHtml = sortedLogs.map(log => `
        <div style="padding: 12px; border-bottom: 1px solid var(--border); display:flex; flex-direction:column; gap:4px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>👤 ${escapeHTML(log.userName)}</strong>
            <span style="font-size:0.75rem; color:var(--text-secondary);">${new Date(log.date).toLocaleString()}</span>
          </div>
          <div><span style="color:var(--primary);">${escapeHTML(log.action)}</span> в задаче: <em>"${escapeHTML(log.taskTitle)}"</em></div>
        </div>
      `).join('');
    }

    modal.innerHTML = `
      <div class="task-modal-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="margin:0;">🔔 Лента активности</h2>
        <button class="btn btn-icon btn-close-notif">✕</button>
      </div>
      <div class="task-modal-body" style="padding:0;">
        ${logsHtml}
      </div>
      <div class="task-modal-footer">
        <button class="btn btn-danger" id="btn-clear-logs">Очистить ленту</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const closeModal = () => {
      overlay.remove();
      modal.remove();
    };

    overlay.onclick = closeModal;
    modal.querySelector('.btn-close-notif').onclick = closeModal;
    
    modal.querySelector('#btn-clear-logs').onclick = async () => {
      if (await CustomDialog.confirm('Очистить всю историю активности?')) {
        store.clearActivityLog();
        closeModal();
      }
    };
  });
});
