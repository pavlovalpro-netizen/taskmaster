/**
 * Защита от XSS (Cross-Site Scripting)
 */
export function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
  }[tag]));
}

/**
 * Преобразует ссылки в тексте в кликабельные HTML-теги
 */
export function linkify(text) {
  const escapedText = escapeHTML(text);
  return escapedText.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
}

/**
 * Всплывающие уведомления
 */
export function toast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg; // Используем textContent для безопасности
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/**
 * Кастомные диалоговые окна (замена стандартным confirm и prompt)
 */
export const CustomDialog = {
  createOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
    return overlay;
  },
  
  createModal(contentHTML) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = contentHTML; // Внутренняя структура модалки безопасна, данные экранируются до вызова
    document.body.appendChild(modal);
    return modal;
  },
  
  close(overlay, modal) {
    if (overlay) overlay.remove();
    if (modal) modal.remove();
  },

  confirm(message) {
    return new Promise((resolve) => {
      const overlay = this.createOverlay();
      const modal = this.createModal(`
        <h3 style="margin-bottom: 16px;">Подтверждение</h3>
        <p style="margin-bottom: 24px;">${escapeHTML(message)}</p>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn" id="dialog-cancel">Отмена</button>
          <button class="btn btn-danger" id="dialog-ok">Подтвердить</button>
        </div>
      `);

      modal.querySelector('#dialog-cancel').onclick = () => {
        this.close(overlay, modal);
        resolve(false);
      };
      
      modal.querySelector('#dialog-ok').onclick = () => {
        this.close(overlay, modal);
        resolve(true);
      };
    });
  },

  prompt(title, defaultValue = '') {
    return new Promise((resolve) => {
      const overlay = this.createOverlay();
      const modal = this.createModal(`
        <h3 style="margin-bottom: 16px;">${escapeHTML(title)}</h3>
        <input type="text" id="dialog-input" class="input-ctrl" value="${escapeHTML(defaultValue)}" placeholder="${escapeHTML(defaultValue)}" style="margin-bottom: 24px;">
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn" id="dialog-cancel">Отмена</button>
          <button class="btn btn-primary" id="dialog-ok">Сохранить</button>
        </div>
      `);

      const input = modal.querySelector('#dialog-input');
      input.focus();
      if (input.value) {
        input.setSelectionRange(input.value.length, input.value.length);
      }

      modal.querySelector('#dialog-cancel').onclick = () => {
        this.close(overlay, modal);
        resolve(null);
      };
      
      modal.querySelector('#dialog-ok').onclick = () => {
        this.close(overlay, modal);
        resolve(input.value.trim());
      };
    });
  }
};
