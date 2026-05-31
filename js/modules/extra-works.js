import { store } from '../store.js';
import { escapeHTML, linkify, toast, CustomDialog } from '../utils.js';
import { Auth } from '../auth.js';

// Чеклист — такой же как в матрице
const CHECKLIST_STEPS = [
  { id: 'c1', label: 'Исп. схемы готовы',           link: 'l1' },
  { id: 'c2', label: 'АОСР сформирован',             link: 'l2', dep: 'c1' },
  { id: 'c3', label: 'Документы качества собраны',   link: 'l3', dep: 'c2' },
  { id: 'c4', label: 'Отправлено технадзору',        link: 'l4', dep: 'c3' },
  { id: 'c5', label: 'Замечания получены',                       dep: 'c4' },
  { id: 'c6', label: 'Исправлено и повторно отправлено', link:'l5', dep:'c5' },
  { id: 'c7', label: 'Подписано участниками',                    dep: 'c6' },
  { id: 'c8', label: 'Финальный реестр подписан',   link:'lFinal',dep:'c7' },
  { id: 'c9', label: 'Сдано в архив',                            dep: 'c8' },
];

function computeStatus(task) {
  if (task.c9) return { status: 's-done',    text: 'В архиве' };
  if (task.c8) return { status: 's-done',    text: 'Реестр подписан' };
  if (task.c7) return { status: 's-dev',     text: 'Подписано' };
  if (task.c6) return { status: 's-dev',     text: 'Исправлено' };
  if (task.c5) return { status: 's-remark',  text: 'Замечания' };
  if (task.c4) return { status: 's-dev',     text: 'У технадзора' };
  if (task.c3) return { status: 's-dev',     text: 'Документы собраны' };
  if (task.c2) return { status: 's-dev',     text: 'АОСР готов' };
  if (task.c1) return { status: 's-dev',     text: 'Схемы готовы' };
  return { status: 's-none', text: 'Не начато' };
}

const WORK_TYPES = ['Рекламация', 'Доп. соглашение', 'Гарантийный случай', 'Прочее'];

export const ExtraWorksModule = {
  filterStatus: '',
  filterType: '',
  filterObject: '',
  searchQuery: '',

  render() {
    const works = store.getDict('works');
    const objects = store.getObjects();

    const typeOpts = WORK_TYPES.map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join('');

    const filterStatusOpts = [
      'Не начато', 'Схемы готовы', 'АОСР готов', 'Документы собраны',
      'У технадзора', 'Замечания', 'Исправлено', 'Подписано',
      'Реестр подписан', 'В архиве'
    ].map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('');

    document.getElementById('tab-extra-works').innerHTML = `
    <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
      
      <!-- Заголовок и кнопка добавления -->
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Дополнительные работы и Рекламации</h3>
        <button class="btn btn-primary" id="btn-add-extra">+ Добавить запись</button>
      </div>

      <!-- Строка фильтров -->
      <div class="form-row" style="flex-wrap:wrap; gap:8px; background:var(--bg); padding:12px; border-radius:var(--radius); border:1px solid var(--border);">
        <input class="input-ctrl" id="ew-search" placeholder="Поиск..." value="${escapeHTML(this.searchQuery)}" style="flex:1; min-width:140px;">
        <select class="input-ctrl" id="ew-filter-type" style="flex:1; min-width:160px;">
          <option value="">Все типы</option>
          ${typeOpts}
        </select>
        <select class="input-ctrl" id="ew-filter-status" style="flex:1; min-width:160px;">
          <option value="">Все статусы</option>
          ${filterStatusOpts}
        </select>
        <button class="btn" id="btn-ew-reset">✕ Сбросить</button>
      </div>

      <!-- Список карточек -->
      <div id="ew-list">
        ${this.renderList()}
      </div>
    </div>

    <!-- Боковое окно -->
    <div class="ew-drawer" id="ew-drawer">
      <div id="ew-drawer-content"></div>
    </div>
    <div class="overlay" id="ew-overlay" style="z-index:199;"></div>`;

    this.attachEvents();
  },

  getFiltered() {
    const all = store.getExtraWorks();
    return all.filter(w => {
      const q = this.searchQuery.toLowerCase();
      const matchSearch = !q || 
        (w.workName || '').toLowerCase().includes(q) ||
        (w.objectName || '').toLowerCase().includes(q) ||
        (w.description || '').toLowerCase().includes(q) ||
        (w.apartments || '').toLowerCase().includes(q);
      const matchType   = !this.filterType   || w.type === this.filterType;
      const matchStatus = !this.filterStatus || computeStatus(w).text === this.filterStatus;
      return matchSearch && matchType && matchStatus;
    });
  },

  renderList() {
    const items = this.getFiltered();
    if (items.length === 0) {
      return `<div style="text-align:center; padding:40px; color:var(--text-secondary);">Нет записей. Нажмите «+ Добавить запись».</div>`;
    }

    return items.map(w => {
      const { status, text } = computeStatus(w);
      const typeColor = {
        'Рекламация': '#fca5a5',
        'Доп. соглашение': '#93c5fd',
        'Гарантийный случай': '#fde68a',
        'Прочее': '#d1d5db'
      }[w.type] || '#d1d5db';

      return `
      <div class="ew-card" data-id="${escapeHTML(w.id)}" style="cursor:pointer;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span class="status-badge ${status}" style="white-space:nowrap;">${escapeHTML(text)}</span>
          <span style="font-size:0.75rem; background:${typeColor}; color:#1e293b; padding:2px 8px; border-radius:10px; font-weight:600;">${escapeHTML(w.type || '')}</span>
          <strong style="flex:1; min-width:150px;">${escapeHTML(w.workName || 'Без названия')}</strong>
        </div>
        <div style="margin-top:8px; display:flex; gap:16px; flex-wrap:wrap; font-size:0.82rem; color:var(--text-secondary);">
          <span>🏢 ${escapeHTML(w.objectName || '—')}</span>
          <span>🏠 ${escapeHTML(w.house || '—')}</span>
          <span>📐 ${escapeHTML(w.section || '—')}</span>
          <span>🏗 Кв: ${escapeHTML(w.apartments || '—')}</span>
          ${w.date ? `<span>📅 ${new Date(w.date).toLocaleDateString()}</span>` : ''}
        </div>
        ${w.description ? `<div style="margin-top:6px; font-size:0.82rem; color:var(--text-secondary); font-style:italic;">${escapeHTML(w.description)}</div>` : ''}
      </div>`;
    }).join('');
  },

  attachEvents() {
    document.getElementById('btn-add-extra').onclick = () => this.openDrawer(null);

    document.getElementById('ew-search').oninput = (e) => {
      this.searchQuery = e.target.value.trim();
      document.getElementById('ew-list').innerHTML = this.renderList();
      this.attachCardEvents();
    };

    document.getElementById('ew-filter-type').onchange = (e) => {
      this.filterType = e.target.value;
      document.getElementById('ew-list').innerHTML = this.renderList();
      this.attachCardEvents();
    };

    document.getElementById('ew-filter-status').onchange = (e) => {
      this.filterStatus = e.target.value;
      document.getElementById('ew-list').innerHTML = this.renderList();
      this.attachCardEvents();
    };

    document.getElementById('btn-ew-reset').onclick = () => {
      this.searchQuery = '';
      this.filterType = '';
      this.filterStatus = '';
      this.render();
    };

    document.getElementById('ew-overlay').onclick = () => this.closeDrawer();
    this.attachCardEvents();
  },

  attachCardEvents() {
    document.querySelectorAll('.ew-card').forEach(card => {
      card.onclick = () => this.openDrawer(card.dataset.id);
    });
  },

  // ──────────────────────────────────────────────────────────────────
  // БОКОВОЕ ОКНО (DRAWER)
  // ──────────────────────────────────────────────────────────────────
  openDrawer(id) {
    let work = id ? store.getExtraWorks().find(w => w.id === id) : null;

    if (!work) {
      // Новая запись — создаём шаблон
      work = {
        id: Date.now().toString(),
        type: 'Рекламация',
        workName: '',
        objectName: '',
        house: '',
        section: '',
        apartments: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        lMain: '', l1: '', l2: '', l3: '', l4: '', l5: '', lFinal: '',
        c1: false, c2: false, c3: false, c4: false, c5: false,
        c6: false, c7: false, c8: false, c9: false,
        remarks: [],
        _isNew: true
      };
    }

    this._currentWork = work;
    document.getElementById('ew-drawer-content').innerHTML = this.buildDrawerHTML(work);
    document.getElementById('ew-drawer').classList.add('open');
    document.getElementById('ew-overlay').classList.add('show');
    this.attachDrawerEvents(work);
  },

  closeDrawer() {
    document.getElementById('ew-drawer').classList.remove('open');
    document.getElementById('ew-overlay').classList.remove('show');
    this._currentWork = null;
    document.getElementById('ew-list').innerHTML = this.renderList();
    this.attachCardEvents();
  },

  buildDrawerHTML(w) {
    const works = store.getDict('works');
    const objects = store.getObjects();
    const workOpts = [...works, ...WORK_TYPES.map(() => null)].filter((_, i) => i < works.length)
      .map(wk => `<option value="${escapeHTML(wk)}" ${w.workName === wk ? 'selected' : ''}>${escapeHTML(wk)}</option>`).join('');
    const typeOpts = WORK_TYPES.map(t => `<option value="${escapeHTML(t)}" ${w.type === t ? 'selected' : ''}>${escapeHTML(t)}</option>`).join('');
    const objOpts = objects.map(o => `<option value="${escapeHTML(o.name)}" ${w.objectName === o.name ? 'selected' : ''}>${escapeHTML(o.name)} — ${escapeHTML(o.house)} (${escapeHTML(o.section)})</option>`).join('');

    const renderLink = (id, label, val) => `
      <div style="margin-bottom:4px;">
        <label style="font-size:0.8rem; color:var(--text-secondary);">${label}</label>
        <div style="display:flex; gap:6px; align-items:center;">
          <input class="input-ctrl ew-link" id="ew-${id}" data-field="${id}" value="${escapeHTML(val || '')}" placeholder="https://...">
          <a class="ew-link-preview" id="ew-${id}-preview" href="${escapeHTML(val || '#')}" target="_blank" style="display:${val ? 'inline' : 'none'}; color:var(--primary);">🔗</a>
        </div>
      </div>`;

    const renderStep = (s, w) => {
      const disabled = s.dep && !w[s.dep];
      const linkVal = s.link ? (w[s.link] || '') : '';
      return `
      <div class="checklist-item ${disabled ? 'locked' : ''}">
        <input type="checkbox" id="ew-chk-${s.id}" class="ew-chk" data-id="${s.id}" ${w[s.id] ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
        <label for="ew-chk-${s.id}">${s.label}</label>
        ${s.link ? renderLink(s.link, '', linkVal) : ''}
      </div>`;
    };

    const { status, text } = computeStatus(w);

    return `
    <div class="drawer-header">
      <div>
        <h3>${w._isNew ? 'Новая запись' : escapeHTML(w.workName || 'Доп. работа')}</h3>
        <div style="margin-top:4px;"><span class="status-badge ${status}">${escapeHTML(text)}</span></div>
      </div>
      <button class="btn btn-icon" id="ew-drawer-close">✕</button>
    </div>
    <div class="drawer-body">
      <div class="drawer-tabs">
        <div class="drawer-tab active" data-ew-tab="main">📋 Основное</div>
        <div class="drawer-tab" data-ew-tab="checklist">✅ Чеклист</div>
        <div class="drawer-tab" data-ew-tab="remarks">📝 Замечания</div>
      </div>

      <!-- Основное -->
      <div id="ew-tab-main">
        <div class="drawer-section">
          <label>Тип</label>
          <select class="input-ctrl" id="ew-type">${typeOpts}</select>
        </div>
        <div class="drawer-section">
          <label>Вид работы</label>
          <input class="input-ctrl" id="ew-workName" value="${escapeHTML(w.workName || '')}" placeholder="Можно выбрать из справочника или ввести вручную" list="ew-works-list">
          <datalist id="ew-works-list">${works.map(wk => `<option value="${escapeHTML(wk)}">`).join('')}</datalist>
        </div>
        <div class="drawer-section">
          <label>Объект</label>
          <input class="input-ctrl" id="ew-objectName" value="${escapeHTML(w.objectName || '')}" placeholder="Название объекта" list="ew-obj-list">
          <datalist id="ew-obj-list">${objects.map(o => `<option value="${escapeHTML(o.name)}">`).join('')}</datalist>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1;">
            <label>Дом</label>
            <input class="input-ctrl" id="ew-house" value="${escapeHTML(w.house || '')}" placeholder="Дом">
          </div>
          <div class="form-group" style="flex:1;">
            <label>Секция</label>
            <input class="input-ctrl" id="ew-section" value="${escapeHTML(w.section || '')}" placeholder="Секция">
          </div>
        </div>
        <div class="drawer-section">
          <label>Квартиры (через запятую)</label>
          <input class="input-ctrl" id="ew-apartments" value="${escapeHTML(w.apartments || '')}" placeholder="напр. 12, 15, 18-22">
        </div>
        <div class="drawer-section">
          <label>Дата</label>
          <input class="input-ctrl" type="date" id="ew-date" value="${escapeHTML(w.date || '')}">
        </div>
        <div class="drawer-section">
          <label>Описание / Причина</label>
          <textarea class="input-ctrl" id="ew-description" rows="3" style="resize:vertical;" placeholder="Подтопление из кровли, трещины и т.д.">${escapeHTML(w.description || '')}</textarea>
        </div>
        <div class="drawer-section">
          <label>📁 Общая папка</label>
          ${renderLink('lMain', '', w.lMain)}
        </div>
      </div>

      <!-- Чеклист -->
      <div id="ew-tab-checklist" class="hidden">
        <div class="drawer-section">
          ${CHECKLIST_STEPS.map(s => renderStep(s, w)).join('')}
        </div>
      </div>

      <!-- Замечания -->
      <div id="ew-tab-remarks" class="hidden">
        <button class="btn" id="ew-btn-add-remark">+ Добавить замечание</button>
        <div class="remark-history" id="ew-remark-list">
          ${this.renderRemarks(w.remarks || [])}
        </div>
      </div>
    </div>

    <!-- Кнопки -->
    <div style="padding:16px 20px; border-top:1px solid var(--border); display:flex; justify-content:space-between; gap:8px; background:var(--bg);">
      ${!w._isNew ? `<button class="btn btn-danger" id="ew-btn-delete">Удалить</button>` : `<div></div>`}
      <button class="btn btn-primary" id="ew-btn-save">💾 Сохранить</button>
    </div>`;
  },

  attachDrawerEvents(work) {
    document.getElementById('ew-drawer-close').onclick = () => this.closeDrawer();

    // Переключение вкладок внутри Drawer
    document.querySelectorAll('.drawer-tab[data-ew-tab]').forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll('.drawer-tab[data-ew-tab]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        ['main','checklist','remarks'].forEach(id => {
          const el = document.getElementById(`ew-tab-${id}`);
          if (el) el.classList.toggle('hidden', id !== tab.dataset.ewTab);
        });
      };
    });

    // Обновление предпросмотра ссылок
    document.querySelectorAll('.ew-link').forEach(input => {
      input.oninput = (e) => {
        const id = e.target.dataset.field;
        const preview = document.getElementById(`ew-${id}-preview`);
        if (preview) {
          const val = e.target.value.trim();
          preview.href = val || '#';
          preview.style.display = val ? 'inline' : 'none';
        }
      };
    });

    // Зависимости чеклиста
    document.querySelectorAll('.ew-chk').forEach(chk => {
      chk.onchange = () => this.updateChecklistDeps();
    });

    // Замечания
    document.getElementById('ew-btn-add-remark')?.addEventListener('click', async () => {
      const text = await CustomDialog.prompt('Текст замечания:');
      if (text) {
        if (!work.remarks) work.remarks = [];
        work.remarks.push({ id: Date.now(), text, status: 'Открыто', date: new Date().toISOString() });
        document.getElementById('ew-remark-list').innerHTML = this.renderRemarks(work.remarks);
      }
    });

    document.getElementById('ew-remark-list').addEventListener('change', (e) => {
      if (e.target.classList.contains('remark-status-select')) {
        const id = parseInt(e.target.dataset.id);
        const rem = work.remarks?.find(r => r.id === id);
        if (rem) rem.status = e.target.value;
      }
    });

    // Удаление
    document.getElementById('ew-btn-delete')?.addEventListener('click', async () => {
      if (await CustomDialog.confirm('Удалить эту запись?')) {
        store.deleteExtraWork(work.id);
        this.closeDrawer();
        toast('Запись удалена', 'info');
      }
    });

    // Сохранение
    document.getElementById('ew-btn-save').onclick = () => this.save(work);
  },

  updateChecklistDeps() {
    const deps = { c2:'c1', c3:'c2', c4:'c3', c5:'c4', c6:'c5', c7:'c6', c8:'c7', c9:'c8' };
    Object.entries(deps).forEach(([child, parent]) => {
      const parentChk = document.getElementById(`ew-chk-${parent}`);
      const childChk  = document.getElementById(`ew-chk-${child}`);
      if (parentChk && childChk) {
        const enabled = parentChk.checked;
        childChk.disabled = !enabled;
        if (!enabled) childChk.checked = false;
        childChk.closest('.checklist-item')?.classList.toggle('locked', !enabled);
      }
    });
  },

  save(work) {
    const g = id => document.getElementById(id);
    work.type        = g('ew-type')?.value       || work.type;
    work.workName    = g('ew-workName')?.value    || '';
    work.objectName  = g('ew-objectName')?.value  || '';
    work.house       = g('ew-house')?.value       || '';
    work.section     = g('ew-section')?.value     || '';
    work.apartments  = g('ew-apartments')?.value  || '';
    work.date        = g('ew-date')?.value        || '';
    work.description = g('ew-description')?.value || '';
    work.lMain = g('ew-lMain')?.value || '';
    ['l1','l2','l3','l4','l5','lFinal'].forEach(id => {
      work[id] = g(`ew-${id}`)?.value || '';
    });
    CHECKLIST_STEPS.forEach(s => {
      work[s.id] = g(`ew-chk-${s.id}`)?.checked || false;
    });

    delete work._isNew;

    if (!work.workName) return toast('Введите вид работы', 'error');

    store.saveExtraWork(work);
    toast('Сохранено', 'success');
    this.closeDrawer();
  },

  renderRemarks(remarks) {
    if (!remarks || remarks.length === 0) return '<div style="color:var(--text-secondary); padding:8px;">Замечаний нет.</div>';
    return remarks.map(r => `
    <div class="remark-item">
      <span>${linkify(r.text)} <small>(${new Date(r.date).toLocaleDateString()})</small></span>
      <select class="input-ctrl remark-status-select" data-id="${r.id}" style="width:auto;">
        <option value="Открыто"    ${r.status==='Открыто'    ? 'selected' : ''}>Открыто</option>
        <option value="Исправлено" ${r.status==='Исправлено' ? 'selected' : ''}>Исправлено</option>
        <option value="Проверено"  ${r.status==='Проверено'  ? 'selected' : ''}>Проверено</option>
      </select>
    </div>`).join('');
  }
};
