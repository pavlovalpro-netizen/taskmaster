import { store } from '../store.js';
import { escapeHTML } from '../utils.js';

export const IncompleteModule = {
  filters: { object: '', house: '', section: '', work: '', status: '' },
  comments: {}, // Хранит локальные комментарии { key: text }

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
        <button class="btn" id="btn-reset-inc-filters">✕ Сбросить</button>
      </div>

      <!-- Таблица -->
      <div class="matrix-scroll" id="incomplete-table-container">
        ${this.buildTable()}
      </div>
    </div>`;

    this.attachEvents();
  },

  buildTable() {
    const objects = store.getObjects();
    const works = store.getDict('works');

    if (objects.length === 0) {
      return '<div style="padding: 40px; text-align: center; color: var(--text-secondary);">Нет объектов. Создайте объекты в разделе «Конфигуратор».</div>';
    }

    // Собираем все строки незавершённых работ
    const rows = [];
    objects.forEach(cfg => {
      cfg.groups.forEach((g, gi) => {
        g.floors.forEach(f => {
          works.forEach((work, wi) => {
            const key = `${cfg.id}_${gi}_${f.num}_${wi}`;
            const t = store.getTask(key);
            // Пропускаем если в архиве (s-done + текст "В архиве")
            if (t.status === 's-done' && t.text === 'В архиве') return;
            // Также пропускаем если вообще не начато и ни одной квартиры — необязательный ряд
            // (Оставляем только те, у которых хоть что-то сделано ИЛИ есть квартиры)
            if (f.apts.length === 0 && t.status === 's-none') return;

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
              remarksOpen: (t.remarks || []).filter(r => r.status === 'Открыто').length
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
        <td><input class="input-ctrl inc-comment" data-key="${escapeHTML(r.key)}" value="${escapeHTML(this.comments[r.key] || '')}" placeholder="Комментарий..." style="min-width: 160px; font-size: 0.8rem;"></td>
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
        this.reattachCommentListeners();
      };
    });

    document.getElementById('btn-reset-inc-filters').onclick = () => {
      this.filters = { object: '', house: '', section: '', work: '', status: '' };
      this.render();
    };

    document.getElementById('btn-export-incomplete').onclick = () => this.exportExcel();

    this.reattachCommentListeners();
  },

  reattachCommentListeners() {
    document.querySelectorAll('.inc-comment').forEach(input => {
      input.oninput = (e) => {
        this.comments[e.target.dataset.key] = e.target.value;
      };
    });
  },

  exportExcel() {
    if (!window.XLSX) { alert('Библиотека Excel не загружена'); return; }
    const table = document.querySelector('#incomplete-table-container table');
    if (!table) { alert('Нет данных для экспорта'); return; }
    window.XLSX.writeFile(window.XLSX.utils.table_to_book(table, { sheet: "Незавершённые" }), "Незавершённые_работы.xlsx");
  }
};
