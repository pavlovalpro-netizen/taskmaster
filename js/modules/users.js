import { store } from '../store.js';
import { escapeHTML, CustomDialog, toast } from '../utils.js';
import { Auth } from '../auth.js';

export const UsersModule = {
  render() {
    document.getElementById('tab-users').innerHTML = `
    <div class="card">
      <h3 style="margin-bottom: 16px;">Управление пользователями</h3>
      <div id="users-list-container">
        <div style="color: var(--text-secondary); padding: 20px;">Загрузка списка...</div>
      </div>
    </div>`;
    this.loadUsers();
  },

  async loadUsers() {
    const container = document.getElementById('users-list-container');
    if (!container) return;

    try {
      const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
      const { db } = await import('../firebase-config.js');
      const querySnapshot = await getDocs(collection(db, "users"));
      
      const users = [];
      querySnapshot.forEach((doc) => users.push({ id: doc.id, ...doc.data() }));

      if (users.length === 0) {
        container.innerHTML = '<div style="color: var(--text-secondary); padding: 20px;">Нет пользователей</div>';
        return;
      }

      const roleLabels = { admin: 'Администратор', engineer: 'Инженер' };
      
      container.innerHTML = `
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: var(--bg);">
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border);">Имя / Email</th>
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border);">Роль</th>
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border);">Действие</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 12px;">
                  <strong>${escapeHTML(u.name || u.email?.split('@')[0] || 'Без имени')}</strong>
                  <div style="font-size: 0.8rem; color: var(--text-secondary);">${escapeHTML(u.email || '')}</div>
                </td>
                <td style="padding: 12px;">
                  <span class="priority-badge badge-${u.role === 'admin' ? 'critical' : 'normal'}">
                    ${roleLabels[u.role] || u.role}
                  </span>
                </td>
                <td style="padding: 12px;">
                  ${u.id === Auth.currentUser.uid 
                    ? '<span style="font-size: 0.8rem; color: var(--text-secondary);">Это вы</span>' 
                    : `<button class="btn btn-sm btn-danger btn-delete-user" data-uid="${escapeHTML(u.id)}" data-name="${escapeHTML(u.name || u.email || '')}">Удалить из списка</button>`
                  }
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
        <p style="margin-top: 12px; font-size: 0.8rem; color: var(--text-secondary);">
          При удалении пользователь исчезает из вашего списка. Если он снова войдёт через Google — он получит роль «Инженер» заново.
        </p>`;

      container.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', async () => {
          const uid = btn.dataset.uid;
          const name = btn.dataset.name;
          if (await CustomDialog.confirm(`Удалить "${name}" из списка пользователей?`)) {
            const ok = await store.deleteUserProfile(uid);
            if (ok) {
              toast('Пользователь удалён из списка', 'success');
              // Обновляем кэш инженеров у Админа
              Auth.usersList = Auth.usersList.filter(u => u.id !== uid);
              this.render();
            } else {
              toast('Ошибка удаления. Проверьте права в Firestore.', 'error');
            }
          }
        });
      });

    } catch (e) {
      console.error(e);
      container.innerHTML = `<div style="color: var(--danger); padding: 20px;">Ошибка загрузки: ${e.message}</div>`;
    }
  }
};
