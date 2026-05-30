import { store } from '../store.js';
import { escapeHTML, linkify, CustomDialog } from '../utils.js';
import { appModules } from '../app.js'; // Чтобы обновить матрицу после закрытия

export const Drawer = {
  current: null,
  
  open(configId, work, floor, apts, groupIdx, workIdx, config) {
    const key = `${configId}_${groupIdx}_${floor}_${workIdx}`;
    this.current = { key, work, floor, apts, groupIdx, workIdx, config };
    const t = store.getTask(key);
    
    document.getElementById('drawer').innerHTML = `
    <div class="drawer-header">
      <div>
        <h3>${escapeHTML(work)}</h3>
        <small>${escapeHTML(config.name)} — ${escapeHTML(config.house)} (${escapeHTML(config.section)}) | ${escapeHTML(String(floor))} этаж</small>
      </div>
      <button class="btn btn-icon" id="drawer-close">✕</button>
    </div>
    <div class="drawer-body">
      <div class="drawer-tabs">
        <div class="drawer-tab active" data-tab="main">📋 Основное</div>
        <div class="drawer-tab" data-tab="remarks">📝 Замечания</div>
      </div>
      
      <div id="drawer-main-content">
        <div class="drawer-section">
          <label>📁 Общая папка</label>
          <input class="input-ctrl" id="lMain" value="${escapeHTML(t.lMain || '')}">
          <div class="link-preview" id="lMain-preview">${t.lMain ? `<a href="${escapeHTML(t.lMain)}" target="_blank">🔗 Открыть</a>` : ''}</div>
        </div>
        
        <div class="drawer-section">
          <div style="display:flex; justify-content:space-between;">
            <label>🏠 Квартиры</label>
            <label><input type="checkbox" id="apt-select-all"> Выбрать все</label>
          </div>
          <div class="apts-grid" id="d-apts">
            ${apts.map(n => `<label><input type="checkbox" class="apt-chk" value="${escapeHTML(String(n))}" ${t.aptsDone?.includes(n) ? 'checked' : ''}> Кв.${escapeHTML(String(n))}</label>`).join('')}
          </div>
        </div>
        
        <div class="drawer-section">
          <label>📋 Чек-лист</label>
          ${this.renderChecklist(t)}
        </div>
        
        <label><input type="checkbox" id="apply-group"> Применить ко всей группе</label>
        <button class="btn btn-primary" id="btn-save-drawer" style="margin-top: 16px;">💾 Сохранить</button>
      </div>
      
      <div id="drawer-remarks-content" class="hidden">
        <button class="btn" id="btn-add-remark">+ Добавить замечание</button>
        <div class="remark-history" id="remark-list">${this.renderRemarks(t.remarks || [])}</div>
      </div>
    </div>`;
    
    document.getElementById('drawer').classList.add('open');
    document.getElementById('overlay').classList.add('show');
    
    this.attachEvents();
    this.updateLinkPreviews();
  },
  
  renderChecklist(t) {
    const steps = [
      { id: 'c1', label: 'Исп. схемы готовы', link: 'l1' },
      { id: 'c2', label: 'АОСР сформирован', link: 'l2', dep: 'c1' },
      { id: 'c3', label: 'Документы качества собраны', link: 'l3', dep: 'c2' },
      { id: 'c4', label: 'Отправлено технадзору', link: 'l4', dep: 'c3' },
      { id: 'c5', label: 'Замечания получены', dep: 'c4' },
      { id: 'c6', label: 'Исправлено и повторно отправлено', link: 'l5', dep: 'c5' },
      { id: 'c7', label: 'Подписано участниками', dep: 'c6' },
      { id: 'c8', label: 'Финальный реестр подписан', link: 'lFinal', dep: 'c7' },
      { id: 'c9', label: 'Сдано в архив', dep: 'c8' }
    ];
    
    return steps.map(s => {
      const disabled = s.dep && !t[s.dep];
      const linkVal = s.link ? (t[s.link] || '') : '';
      return `
      <div class="checklist-item ${disabled ? 'locked' : ''}">
        <input type="checkbox" id="${s.id}" ${t[s.id] ? 'checked' : ''} ${disabled ? 'disabled' : ''} data-id="${s.id}">
        <label for="${s.id}">${s.label}</label>
        ${s.link ? `<div><input class="input-ctrl link-input" id="${s.link}" value="${escapeHTML(linkVal)}" data-preview="${s.link}-preview"><div class="link-preview" id="${s.link}-preview">${linkVal ? `<a href="${escapeHTML(linkVal)}" target="_blank">🔗</a>` : ''}</div></div>` : ''}
      </div>`;
    }).join('');
  },
  
  attachEvents() {
    document.getElementById('drawer-close').onclick = () => this.close();
    document.getElementById('overlay').onclick = () => this.close();
    
    // Вкладки
    document.querySelectorAll('.drawer-tab').forEach(t => t.onclick = (e) => {
      document.querySelectorAll('.drawer-tab').forEach(el => el.classList.remove('active'));
      e.target.classList.add('active');
      const isMain = e.target.dataset.tab === 'main';
      document.getElementById('drawer-main-content').classList.toggle('hidden', !isMain);
      document.getElementById('drawer-remarks-content').classList.toggle('hidden', isMain);
    });
    
    document.getElementById('btn-save-drawer').onclick = () => this.save();
    
    document.getElementById('btn-add-remark')?.addEventListener('click', () => this.addRemark());
    
    document.getElementById('lMain').oninput = (e) => this.updateLinkPreview(e.target, 'lMain-preview');
    document.querySelectorAll('.link-input').forEach(input => {
      input.oninput = (e) => this.updateLinkPreview(e.target, e.target.dataset.preview);
    });
    
    // Выбрать все квартиры
    const selectAllCheckbox = document.getElementById('apt-select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.onchange = () => {
        document.querySelectorAll('.apt-chk').forEach(c => c.checked = selectAllCheckbox.checked);
      };
    }

    // Зависимости чекбоксов (делегирование)
    document.getElementById('drawer-main-content').addEventListener('change', (e) => {
      if (e.target.type === 'checkbox' && e.target.id && e.target.id.startsWith('c')) {
        this.handleCheckboxChange(e.target.id);
      }
    });

    // Изменение статуса замечания (делегирование)
    document.getElementById('remark-list').addEventListener('change', (e) => {
      if (e.target.classList.contains('remark-status-select')) {
        const id = parseInt(e.target.dataset.id);
        const rem = this.current.remarks.find(x => x.id === id);
        if (rem) rem.status = e.target.value;
      }
    });
  },
  
  handleCheckboxChange(id) {
    const cb = document.getElementById(id);
    if (!cb) return;
    this.updateDepsRecursive(id, cb.checked);
  },
  
  updateDepsRecursive(parentId, checked) {
    const deps = { c2: 'c1', c3: 'c2', c4: 'c3', c5: 'c4', c6: 'c5', c7: 'c6', c8: 'c7', c9: 'c8' };
    Object.entries(deps).forEach(([child, parent]) => {
      if (parent === parentId) {
        const childCb = document.getElementById(child);
        if (childCb) {
          childCb.disabled = !checked;
          if (!checked) childCb.checked = false;
          const div = childCb.closest('.checklist-item');
          if (div) div.classList.toggle('locked', !checked);
          this.updateDepsRecursive(child, checked);
        }
      }
    });
  },
  
  updateLinkPreview(inputElement, previewId) {
    const preview = document.getElementById(previewId);
    if (inputElement && preview) {
      const val = inputElement.value.trim();
      preview.innerHTML = val ? `<a href="${escapeHTML(val)}" target="_blank">🔗</a>` : '';
    }
  },
  
  updateLinkPreviews() { 
    this.updateLinkPreview(document.getElementById('lMain'), 'lMain-preview');
    ['l1','l2','l3','l4','l5','lFinal'].forEach(id => this.updateLinkPreview(document.getElementById(id), `${id}-preview`)); 
  },
  
  save() {
    const data = {};
    ['lMain', 'l1', 'l2', 'l3', 'l4', 'l5', 'lFinal'].forEach(id => data[id] = document.getElementById(id)?.value || '');
    ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'].forEach(id => data[id] = document.getElementById(id)?.checked || false);
    
    data.aptsDone = [...document.querySelectorAll('.apt-chk:checked')].map(c => parseInt(c.value));
    data.remarks = this.current?.remarks || [];
    
    const aptsTotal = this.current.apts.length;
    const missing = aptsTotal - data.aptsDone.length;
    
    let status = 's-none', text = 'Не начато';
    if (data.c9) { status = 's-done'; text = 'В архиве'; }
    else if (data.c8) { status = 's-done'; text = 'Реестр подписан'; }
    else if (data.c7) { status = 's-dev'; text = 'Подписано'; }
    else if (data.c6) { status = 's-dev'; text = 'Исправлено'; }
    else if (data.c5) { status = 's-remark'; text = 'Замечания'; }
    else if (data.c4) { status = 's-dev'; text = 'У технадзора'; }
    else if (data.c3) { status = 's-dev'; text = 'Документы собраны'; }
    else if (data.c2) { status = 's-dev'; text = 'АОСР готов'; }
    else if (data.c1) { status = 's-dev'; text = 'Схемы готовы'; }
    
    if (aptsTotal > 0 && missing > 0 && status !== 's-done') {
      text += ` (${missing} кв.)`;
    }
    
    data.status = status; 
    data.text = text;
    
    if (document.getElementById('apply-group')?.checked) {
      const g = this.current.config.groups[this.current.groupIdx];
      g.floors.forEach(f => {
        store.setTask(`${this.current.config.id}_${this.current.groupIdx}_${f.num}_${this.current.workIdx}`, { ...data, aptsDone: [...f.apts] });
      });
    } else {
      store.setTask(this.current.key, data);
    }
    
    this.close(); 
    if (appModules.matrix) appModules.matrix.loadMatrix();
  },
  
  async addRemark() {
    const text = await CustomDialog.prompt('Текст замечания:');
    if (!text) return;
    
    if (!this.current.remarks) this.current.remarks = [];
    this.current.remarks.push({ id: Date.now(), text, status: 'Открыто', date: new Date().toISOString() });
    document.getElementById('remark-list').innerHTML = this.renderRemarks(this.current.remarks);
  },
  
  renderRemarks(remarks) {
    return remarks.map(r => `
    <div class="remark-item">
      <span>${linkify(r.text)} <small>(${new Date(r.date).toLocaleDateString()})</small></span>
      <select class="input-ctrl remark-status-select" data-id="${r.id}" style="width: auto;">
        <option value="Открыто" ${r.status === 'Открыто' ? 'selected' : ''}>Открыто</option>
        <option value="Исправлено" ${r.status === 'Исправлено' ? 'selected' : ''}>Исправлено</option>
        <option value="Проверено" ${r.status === 'Проверено' ? 'selected' : ''}>Проверено</option>
      </select>
    </div>`).join('');
  },
  
  close() {
    document.getElementById('drawer').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
    this.current = null;
  }
};
