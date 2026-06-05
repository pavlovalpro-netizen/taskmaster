import { store } from '../store.js';
import { escapeHTML } from '../utils.js';

export const IncompleteModule = {
  filters: { object: '', house: '', section: '', work: '', status: '', type: '' },

  render() {
    document.getElementById('tab-incomplete').innerHTML = `
    <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3>Незавершённые работы</h3>
        <button class="btn btn-excel" id="btn-export-incomplete">📥 Экспорт Excel</button>
      </div>
      
      <!-- Строки фильтров по каждому столбцу -->
      <div class="form-row" style="flex-wrap: wrap; gap: 8px; background: var(--bg); padding: 12px; border-radius: var(--radius); border: 1px solid var(--border);">
        <input class="input-ctrl inc-filter" data-col="object"  placeholder="Фильтр: Объект" value="${escapeHTML(this.filters.object)}" style="flex: 1; min-width: 120px;">
        <input class="input-ctrl inc-filter" data-col="house"   placeholder="Фильтр: Дом" value="${escapeHTML(this.filters.house)}" style="flex: 1; min-width: 100px;">
        <input class="input-ctrl inc-filter" data-col="section" placeholder="Фильтр: Секция" value="${escapeHTML(this.filters.section)}" style="flex: 1; min-width: 100px;">
        <input class="input-ctrl inc-filter" data-col="work"    placeholder="Фильтр: Вид работы" value="${escapeHTML(this.filters.work)}" style="flex: 1; min-width: 140px;">
        <input class="input-ctrl inc-filter" data-col="status"  placeholder="Фильтр: Статус" value="${escapeHTML(this.filters.status)}" style="flex: 1; min-width: 120px;">
        <select class="input-ctrl inc-filter" data-col="type" style="flex: 1; min-width: 120px;">
          <option value="">Тип (Все)</option>
          <option value="apts" ${this.filters.type === 'apts' ? 'selected' : ''}>Квартиры</option>
          <option value="mop" ${this.filters.type === 'mop' ? 'selected' : ''}>МОП</option>
        </select>
        <button class="btn" id="btn-reset-inc-filters">Сброс</button>
      </div>

      <!-- Таблица -->
      <div class="matrix-scroll" id="incomplete-table-container">
        ${this.buildTable()}
      </div>
    </div>

    <!-- Модальное окно комментариев -->
    <div class="overlay" id="inc-modal-overlay" style="z-index: 1000; align-items:center; justify-content:center; display:none;">
      <div class="card" style="width: 500px; max-width: 90vw; background: var(--surface); display:flex; flex-direction:column; max-height:80vh;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h3 style="margin:0;">💬 История комментариев</h3>
          <button class="btn btn-icon" id="inc-modal-close">✕</button>
        </div>
        <div id="inc-modal-list" style="flex:1; overflow-y:auto; margin-bottom:12px; display:flex; flex-direction:column; gap:8px;"></div>
        <div style="display:flex; gap:8px;">
          <input type="text" id="inc-modal-input" class="input-ctrl" placeholder="Новый комментарий..." style="flex:1;">
          <button class="btn btn-primary" id="inc-modal-send">Отправить</button>
        </div>
      </div>
    </div>`;

    this.attachEvents();
  },

  buildTable() {
    const objects = store.getObjects();
    const worksApts = store.getDict('works');
    const worksMop = store.getDict('worksMop');
    const works = [...worksApts, ...worksMop];

    if (objects.length === 0) {
      return '<div style="padding: 40px; text-align: center; color: var(--text-secondary);">Нет объектов. Создайте объекты в разделе «Конфигуратор».</div>';
    }

    // Собираем все строки незавершённых работ
    const rows = [];
    objects.forEach(cfg => {
      cfg.groups.forEach((g, gi) => {
        g.floors.forEach(f => {
          works.forEach((work, wi) => {
            const isMop = wi >= worksApts.length;
            const workType = isMop ? 'mop' : 'apts';
            if (this.filters.type && this.filters.type !== workType) return;
            const key = `${cfg.id}_${gi}_${f.num}_${wi}`;
            const t = store.getTask(key);
            // Пропускаем если в архиве (s-done + текст "В архиве")
            if (t.status === 's-done' && t.text === 'В архиве') return;
            // Также пропускаем если вообще не начато и ни одной квартиры — необязательный ряд
            // (Оставляем только те, у которых хоть что-то сделано ИЛИ есть квартиры)
            if ((f.apts || []).length === 0 && t.status === 's-none') return;

              rows.push({
                key,
                object: cfg.name,
                house: cfg.house,
                section: cfg.section,
                floor: f.num < 0 ? `Подвал ${f.num}` : `${f.num} эт.`,
                work,
                status: t.text || 'Не начато',
                l1: t.l1 || '',  // Исп. схемы
                l2: t.l2 || '',  // АОСР
                lMain: t.lMain || '',
                remarksOpen: (t.remarks || []).filter(r => r.status === 'Открыто').length,
                commentsCount: (t.comments || []).length
              });
          });
        });
      });
    });

    // Применяем фильтры
    const filtered = rows.filter(r => {
      return (
        (!this.filters.object  || r.object.toLowerCase().includes(this.filters.object.toLowerCase())) &&
        (!this.filters.house   || r.house.toLowerCase().includes(this.filters.house.toLowerCase())) &&
        (!this.filters.section || r.section.toLowerCase().includes(this.filters.section.toLowerCase())) &&
        (!this.filters.work    || r.work.toLowerCase().includes(this.filters.work.toLowerCase())) &&
        (!this.filters.status  || r.status.toLowerCase().includes(this.filters.status.toLowerCase()))
      );
    });

    if (filtered.length === 0) {
      return '<div style="padding: 40px; text-align: center; color: var(--success); font-size: 1.1rem;">Все работы завершены!</div>';
    }

    const link = (url, label) => url ? `<a href="${escapeHTML(url)}" target="_blank" style="color: var(--primary); text-decoration: none;" title="${escapeHTML(url)}">${label}</a>` : '—';

    const rows_html = filtered.map(r => `
      <tr>
        <td>${escapeHTML(r.object)}</td>
        <td>${escapeHTML(r.house)}</td>
        <td>${escapeHTML(r.section)}</td>
        <td>${escapeHTML(r.floor)}</td>
        <td>${escapeHTML(r.work)}</td>
        <td><span class="status-text">${escapeHTML(r.status)}</span></td>
        <td>${link(r.lMain, '📁 Открыть')}</td>
        <td>${link(r.l1, '📄 Открыть')}</td>
        <td>${link(r.l2, '📑 Открыть')}</td>
        <td>${r.remarksOpen > 0 ? `<span style="color:var(--danger); font-weight:600;">${r.remarksOpen} откр.</span>` : '—'}</td>
        <td><button class="btn btn-sm inc-btn-comment" data-key="${escapeHTML(r.key)}">💬 Комментарии (${r.commentsCount})</button></td>
      </tr>`).join('');

    return `
      <table style="font-size: 0.85rem;">
        <thead>
          <tr>
            <th>Объект</th>
            <th>Дом</th>
            <th>Секция</th>
            <th>Этаж</th>
            <th>Вид работы</th>
            <th>Статус</th>
            <th>Папка</th>
            <th>Исп. схемы</th>
            <th>АОСР</th>
            <th>Замечания</th>
            <th>Комментарий</th>
          </tr>
        </thead>
        <tbody>${rows_html}</tbody>
      </table>
      <div style="padding: 8px 0; font-size: 0.8rem; color: var(--text-secondary);">Найдено: ${filtered.length} записей</div>`;
  },

  attachEvents() {
    document.querySelectorAll('.inc-filter').forEach(input => {
      input.oninput = (e) => {
        this.filters[e.target.dataset.col] = e.target.value;
        document.getElementById('incomplete-table-container').innerHTML = this.buildTable();
        this.attachCommentEvents();
      };
    });

    document.getElementById('btn-reset-inc-filters').onclick = () => {
      this.filters = { object: '', house: '', section: '', work: '', status: '', type: '' };
      this.render();
    };

    document.getElementById('btn-export-incomplete').onclick = () => this.exportExcel();

    this.attachCommentEvents();

    document.getElementById('inc-modal-close').onclick = () => {
      document.getElementById('inc-modal-overlay').style.display = 'none';
      this.currentTaskKey = null;
    };
  },

  attachCommentEvents() {
    document.querySelectorAll('.inc-btn-comment').forEach(btn => {
      btn.onclick = () => this.openCommentsModal(btn.dataset.key);
    });
  },

  openCommentsModal(key) {
    this.currentTaskKey = key;
    const overlay = document.getElementById('inc-modal-overlay');
    overlay.style.display = 'flex';
    this.renderCommentsList();

    const sendBtn = document.getElementById('inc-modal-send');
    const input = document.getElementById('inc-modal-input');
    
    // Снимаем старые обработчики, если были (хак через замену узла)
    const newSendBtn = sendBtn.cloneNode(true);
    sendBtn.parentNode.replaceChild(newSendBtn, sendBtn);
    
    newSendBtn.onclick = () => {
      const text = input.value.trim();
      if (!text) return;
      const t = store.getTask(key);
      if (!t.comments) t.comments = [];
      import('../auth.js').then(({ Auth }) => {
        const author = Auth.currentUser.displayName || Auth.currentUser.email.split('@')[0];
        t.comments.push({ id: Date.now(), text, date: new Date().toISOString(), author });
        store.setTask(key, t);
        input.value = '';
        this.renderCommentsList();
        document.getElementById('incomplete-table-container').innerHTML = this.buildTable();
        this.attachCommentEvents();
      });
    };
  },

  renderCommentsList() {
    const list = document.getElementById('inc-modal-list');
    if (!this.currentTaskKey) return;
    const t = store.getTask(this.currentTaskKey);
    const comments = t.comments || [];
    if (comments.length === 0) {
      list.innerHTML = '<div style="color:var(--text-secondary); text-align:center; margin-top:20px;">Пока нет комментариев</div>';
      return;
    }
    list.innerHTML = comments.map(c => `
      <div style="background:var(--bg); padding:8px 12px; border-radius:var(--radius); font-size:0.85rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:0.75rem; color:var(--text-secondary);">
          <strong>${escapeHTML(c.author || 'Неизвестно')}</strong>
          <span>${new Date(c.date).toLocaleString()}</span>
        </div>
        <div>${escapeHTML(c.text)}</div>
      </div>
    `).join('');
    list.scrollTop = list.scrollHeight;
  },

  exportExcel() {
    if (!window.XLSX) { alert('Библиотека Excel не загружена'); return; }
    const table = document.querySelector('#incomplete-table-container table');
    if (!table) { alert('Нет данных для экспорта'); return; }
    window.XLSX.writeFile(window.XLSX.utils.table_to_book(table, { sheet: "Незавершённые" }), "Незавершённые_работы.xlsx");
  }
};
