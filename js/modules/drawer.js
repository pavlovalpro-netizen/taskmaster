import { store } from '../store.js';
import { escapeHTML, linkify, CustomDialog } from '../utils.js';
import { appModules } from '../app.js';

// Вспомогательная функция: разбор строки диапазона этажей типа "2-5, 8, 12-17"
function parseFloorRange(input) {
  const result = new Set();
  const parts = input.split(',').map(s => s.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) result.add(i);
      }
    } else {
      const n = Number(part);
      if (!isNaN(n)) result.add(n);
    }
  }
  return result;
}

export const Drawer = {
  current: null,
  
  open(configId, work, floorNum, floorObj, groupIdx, workIdx, config, workType = 'apts') {
    const key = `${configId}_${groupIdx}_${floorNum}_${workIdx}`;
    this.current = { key, work, floorNum, floorObj, groupIdx, workIdx, config, workType };
    const t = store.getTask(key);
    
    // Строим диапазон этажей по умолчанию для группы
    const group = config.groups[groupIdx];
    const allFloors = group ? group.floors.map(f => f.num) : [];
    const defaultRange = floor.toString();
    
    document.getElementById('drawer').innerHTML = `
    <div class="drawer-header">
      <div>
        <small>${escapeHTML(config.name)} — ${escapeHTML(config.house)} (${escapeHTML(config.section)}) | ${escapeHTML(String(floorNum))} этаж</small>
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
            <label>${workType === 'mop' ? '🏢 Зоны МОП' : '🏠 Квартиры'}</label>
            <label><input type="checkbox" id="apt-select-all"> Выбрать все</label>
          </div>
          <div class="apt-grid">
            ${(workType === 'mop' ? (floorObj.mopZones || []) : (floorObj.apts || [])).map(item => {
              const doneArr = workType === 'mop' ? (t.mopDone || []) : (t.aptsDone || []);
              return `<label class="apt-btn"><input type="checkbox" class="apt-chk" value="${escapeHTML(String(item))}" ${doneArr.includes(item) ? 'checked' : ''}> ${escapeHTML(String(item))}</label>`;
            }).join('')}
          </div>
        </div>
        
        <div class="drawer-section">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <label style="margin:0;">📋 Чек-лист</label>
            <label style="font-size:0.8rem; cursor:pointer;"><input type="checkbox" id="chk-select-all" style="margin-right:4px;"> Выбрать всё</label>
          </div>
          ${this.renderChecklist(t)}
        </div>
        
        <!-- Гибкое применение этажей -->
        <div class="drawer-section" style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px;">
          <label style="font-weight: 600; display: block; margin-bottom: 8px;">Применить к этажам:</label>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <input id="apply-floors-input" class="input-ctrl" style="flex: 1; min-width: 150px;"
              placeholder="напр. 2-5, 8, 12-17"
              value="${escapeHTML(defaultRange)}"
              title="Введите этажи: через запятую или диапазон через дефис. Пример: 2-5, 8, 12-17">
            <button class="btn btn-sm" id="btn-fill-all-floors" title="Вставить все этажи группы">
              Вся группа (${allFloors.length} эт.)
            </button>
          </div>
          <div style="margin-top: 6px; font-size: 0.75rem; color: var(--text-secondary);">
            Этажи в группе: ${allFloors.join(', ')}
          </div>
        </div>
        
        <button class="btn btn-primary" id="btn-save-drawer" style="margin-top: 16px; width: 100%;">💾 Сохранить</button>
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
    
    const selectAllCheckbox = document.getElementById('apt-select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.onchange = () => {
        document.querySelectorAll('.apt-chk').forEach(c => c.checked = selectAllCheckbox.checked);
      };
    }

    const selectAllChk = document.getElementById('chk-select-all');
    if (selectAllChk) {
      selectAllChk.onchange = () => {
        const checked = selectAllChk.checked;
        document.querySelectorAll('.checklist-item input[type="checkbox"]').forEach(c => {
          c.checked = checked;
          c.disabled = false;
          c.closest('.checklist-item')?.classList.remove('locked');
        });
        if (!checked) {
          this.handleCheckboxChange('c1');
        }
      };
    }

    document.getElementById('btn-fill-all-floors')?.addEventListener('click', () => {
      const group = this.current.config.groups[this.current.groupIdx];
      if (group) {
        const floors = group.floors.map(f => f.num);
        document.getElementById('apply-floors-input').value = this.toRangeString(floors);
      }
    });

    document.getElementById('drawer-main-content').addEventListener('change', (e) => {
      if (e.target.type === 'checkbox' && e.target.id && e.target.id.startsWith('c')) {
        this.handleCheckboxChange(e.target.id);
      }
    });

    document.getElementById('remark-list').addEventListener('change', (e) => {
      if (e.target.classList.contains('remark-status-select')) {
        const id = parseInt(e.target.dataset.id);
        const rem = this.current.remarks?.find(x => x.id === id);
        if (rem) rem.status = e.target.value;
      }
    });
  },

  toRangeString(floors) {
    if (!floors || floors.length === 0) return '';
    const sorted = [...floors].sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0], end = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) { end = sorted[i]; }
      else { ranges.push(start === end ? `${start}` : `${start}-${end}`); start = end = sorted[i]; }
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    return ranges.join(', ');
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
          childCb.closest('.checklist-item')?.classList.toggle('locked', !checked);
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
    const data = store.getTask(this.current.key) || {};
    ['c1','c2','c3','c4','c5','c6','c7','c8','c9'].forEach(c => data[c] = document.getElementById(c)?.checked || false);
    ['l1','l2','l3','l4','l5','lFinal','lMain'].forEach(l => data[l] = document.getElementById(l)?.value || '');
    
    const doneArr = Array.from(document.querySelectorAll('.apt-chk:checked')).map(cb => {
      return this.current.workType === 'mop' ? cb.value : parseInt(cb.value);
    });
    
    if (this.current.workType === 'mop') {
      data.mopDone = doneArr;
    } else {
      data.aptsDone = doneArr;
    }
    
    const itemsTotal = this.current.workType === 'mop' ? (this.current.floorObj.mopZones || []).length : (this.current.floorObj.apts || []).length;
    const missing = itemsTotal - doneArr.length;
    
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
    
    if (itemsTotal > 0 && missing > 0 && status !== 's-done') {
      text += this.current.workType === 'mop' ? ` (${missing} пом.)` : ` (${missing} кв.)`;
    }
    data.status = status;
    data.text = text;
    
    // Применение к выбранным этажам
    // Определяем, сохраняем ли на один этаж или на диапазон
    const floorInput = document.getElementById('apply-floors-input')?.value?.trim() || '';
    const selectedFloors = parseFloorRange(floorInput);
    const group = this.current.config.groups[this.current.groupIdx];
    const isSingleFloor = selectedFloors.size <= 1;

    if (!isSingleFloor && group && selectedFloors.size > 0) {
      // Применяем к нескольким этажам
      // Для каждого этажа в диапазоне:
      //   - чеклист и ссылки берём одинаковые
      //   - aptsDone: если выбранные квартиры принадлежат этому этажу — ставим их,
      //     иначе ставим ВСЕ квартиры этажа (логика «сделано для всего этажа»)
      let savedCount = 0;
      group.floors.forEach(f => {
        if (selectedFloors.has(f.num)) {
          // Считаем missing для конкретного этажа
          // При применении к диапазону — весь этаж считается сделанным
          const fItemsDone = this.current.workType === 'mop' ? [...(f.mopZones || [])] : [...(f.apts || [])];
          const fMissing = 0;
          let floorText = data.text.replace(/ \(\d+ (кв\.|пом\.)\)$/, '');
          
          if (fMissing > 0 && data.status !== 's-done') {
            floorText += this.current.workType === 'mop' ? ` (${fMissing} пом.)` : ` (${fMissing} кв.)`;
          }

          const newTaskData = { ...data, text: floorText };
          if (this.current.workType === 'mop') {
            newTaskData.mopDone = fItemsDone;
          } else {
            newTaskData.aptsDone = fItemsDone;
          }

          store.setTask(
            `${this.current.config.id}_${this.current.groupIdx}_${f.num}_${this.current.workIdx}`,
            newTaskData
          );
          savedCount++;
        }
      });
      import('../utils.js').then(({ toast }) => toast(`Сохранено на ${savedCount} этажах`, 'success'));
    } else {
      // Сохраняем только текущий этаж с точными отмеченными квартирами
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
