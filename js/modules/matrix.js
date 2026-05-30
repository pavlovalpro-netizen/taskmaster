import { store } from '../store.js';
import { escapeHTML, toast } from '../utils.js';
import { Drawer } from './drawer.js';

export const Matrix = {
  activeConfigId: null,
  activeHouse: null,
  viewMode: 'detail',
  
  render() {
    document.getElementById('tab-matrix').innerHTML = `
    <div class="card"><div class="form-row">
      <div class="form-group">
        <label>Режим</label>
        <select id="matrix-view-mode" class="input-ctrl">
          <option value="detail">Детально (секция)</option>
          <option value="house">Сводка по дому</option>
        </select>
      </div>
      <div class="form-group" id="matrix-selector-container"></div>
      <div class="form-group">
        <label>Поиск</label>
        <input id="matrix-search" class="input-ctrl" placeholder="Название работы...">
      </div>
      <button class="btn" id="btn-undo">↩ Отменить</button>
      <button class="btn btn-excel" id="btn-export">📥 Excel</button>
    </div></div>
    <div class="matrix-scroll" id="matrix-table-container">Выберите объект</div>`;
    
    this.attachEvents(); 
    this.updateSelectors();
  },
  
  attachEvents() {
    document.getElementById('matrix-view-mode').onchange = (e) => { 
      this.viewMode = e.target.value; 
      this.updateSelectors(); 
      this.loadMatrix(); 
    };
    
    document.getElementById('btn-undo').onclick = () => { 
      store.undoLastTask() ? (toast('Отменено','warning'), this.loadMatrix()) : toast('Нет действий для отмены','info'); 
    };
    
    document.getElementById('btn-export').onclick = () => this.exportExcel();
    
    document.getElementById('matrix-search').oninput = () => this.filterColumns();
    
    // Delegation for table cells
    document.getElementById('matrix-table-container').addEventListener('click', (e) => {
      const td = e.target.closest('td[data-key]');
      if (td) {
        const [configId, groupIdx, floorNum, workIdx] = td.dataset.key.split('::').map((v, i) => i ? parseInt(v) : v);
        const cfg = store.getObjects().find(o => o.id === configId);
        if (!cfg) { 
          toast('Объект не найден','error'); 
          return; 
        }
        const apts = cfg.groups[groupIdx]?.floors.find(f => f.num === floorNum)?.apts || [];
        Drawer.open(configId, store.getDict('works')[workIdx], floorNum, apts, groupIdx, workIdx, cfg);
      }
    });
  },
  
  updateSelectors() {
    const cont = document.getElementById('matrix-selector-container');
    if (this.viewMode === 'detail') {
      cont.innerHTML = `<label>Объект (секция)</label><select id="matrix-obj-select" class="input-ctrl"></select>`;
      const sel = document.getElementById('matrix-obj-select');
      sel.innerHTML = '<option value="">— Выберите —</option>' + 
        store.getObjects().map(o => `<option value="${escapeHTML(o.id)}">${escapeHTML(o.name)} — ${escapeHTML(o.house)} (${escapeHTML(o.section)})</option>`).join('');
      sel.value = this.activeConfigId || '';
      sel.onchange = (e) => { 
        this.activeConfigId = e.target.value; 
        this.loadMatrix(); 
      };
      if (this.activeConfigId) this.loadMatrix();
    } else {
      cont.innerHTML = `<label>Дом / Объект</label><select id="matrix-house-select" class="input-ctrl"></select>`;
      const houses = [...new Set(store.getObjects().map(o => o.house))];
      const sel = document.getElementById('matrix-house-select');
      sel.innerHTML = '<option value="">— Выберите дом —</option>' + 
        houses.map(h => `<option value="${escapeHTML(h)}">${escapeHTML(h)}</option>`).join('');
      sel.value = this.activeHouse || '';
      sel.onchange = (e) => { 
        this.activeHouse = e.target.value; 
        this.loadHouseSummary(); 
      };
      if (this.activeHouse) this.loadHouseSummary();
    }
  },
  
  loadMatrix() {
    if (this.viewMode !== 'detail') return;
    const config = store.getObjects().find(c => c.id === this.activeConfigId);
    const container = document.getElementById('matrix-table-container');
    
    if (!config) { 
      container.innerHTML = '<p style="padding:40px;">Выберите объект</p>'; 
      return; 
    }
    
    const works = store.getDict('works');
    let html = '<table><thead><tr><th>Структура</th>';
    works.forEach((w, i) => html += `<th class="col-w-${i}">${escapeHTML(w)}</th>`);
    html += '</tr></thead><tbody>';
    
    config.groups.forEach((g, gi) => {
      html += `<tr style="background:var(--bg);font-weight:700;"><td colspan="${works.length + 1}">📁 ${escapeHTML(g.rawName)}</td></tr>`;
      g.floors.forEach(f => {
        const label = f.num < 0 ? `Подвал ${f.num}` : `${f.num} эт.`;
        html += `<tr><td>${label}</td>`;
        works.forEach((w, wi) => {
          const key = `${config.id}_${gi}_${f.num}_${wi}`;
          const t = store.getTask(key);
          const missing = (f.apts.length - (t.aptsDone?.length || 0));
          const indicator = (f.apts.length > 0 && missing > 0) ? `<span class="apt-indicator">${missing}</span>` : '';
          html += `<td class="col-w-${wi}" data-key="${escapeHTML(config.id)}::${gi}::${f.num}::${wi}"><span class="status-badge ${t.status}">${escapeHTML(t.text)}${indicator}</span></td>`;
        });
        html += '</tr>';
      });
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
    this.filterColumns();
  },
  
  loadHouseSummary() {
    const house = this.activeHouse;
    const configs = store.getObjects().filter(o => o.house === house);
    const container = document.getElementById('matrix-table-container');
    
    if (configs.length === 0) { 
      container.innerHTML = '<p style="padding:40px;">Нет секций для выбранного дома</p>'; 
      return; 
    }
    
    const works = store.getDict('works');
    let html = '<table><thead><tr><th>Секция</th>';
    works.forEach(w => html += `<th>${escapeHTML(w)}</th>`);
    html += '</tr></thead><tbody>';
    
    configs.forEach(cfg => {
      html += `<tr><td>${escapeHTML(cfg.section)}</td>`;
      works.forEach((w, wi) => {
        let done = 0, total = 0;
        cfg.groups.forEach(g => g.floors.forEach(f => {
          const key = `${cfg.id}_${cfg.groups.indexOf(g)}_${f.num}_${wi}`;
          if (store.getTask(key).status === 's-done') done++;
          total++;
        }));
        html += `<td>${total ? Math.round(done / total * 100) : 0}%</td>`;
      });
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  },
  
  filterColumns() {
    const query = document.getElementById('matrix-search')?.value.toLowerCase() || '';
    const works = store.getDict('works');
    document.querySelectorAll('[class*="col-w-"]').forEach(el => {
      const cls = [...el.classList].find(c => c.startsWith('col-w-'));
      if (cls) {
        const index = parseInt(cls.split('-')[2]);
        const workName = works[index]?.toLowerCase() || '';
        el.style.display = (!query || workName.includes(query)) ? '' : 'none';
      }
    });
  },
  
  exportExcel() {
    if (!window.XLSX) {
      toast('Библиотека Excel не загружена', 'error');
      return;
    }
    const table = document.querySelector('#matrix-table-container table');
    if (!table) return toast('Нет данных для экспорта', 'error');
    XLSX.writeFile(XLSX.utils.table_to_book(table, { sheet: "Матрица" }), "Сводка_ИД.xlsx");
    toast('Успешно выгружено', 'success');
  }
};
