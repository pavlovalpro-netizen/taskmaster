import { store } from '../store.js';
import { escapeHTML, toast } from '../utils.js';
import { Drawer } from './drawer.js';

export const Matrix = {
  activeConfigId: null,
  activeHouse: null,
  viewMode: 'detail',
  filterStatus: '',
  
  render() {
    const filterStatusOpts = [
      'Не начато', 'Схемы готовы', 'АОСР готов', 'Документы собраны',
      'У технадзора', 'Замечания', 'Исправлено', 'Подписано',
      'Реестр подписан', 'В архиве'
    ].map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('');

    document.getElementById('tab-matrix').innerHTML = `
    <div class="card"><div class="form-row" style="flex-wrap: wrap; align-items: end;">
      <div class="form-group">
        <label>Режим</label>
        <select id="matrix-view-mode" class="input-ctrl">
          <option value="detail">Детально (секция)</option>
          <option value="house">Сводка по дому</option>
        </select>
      </div>
      <div class="form-group" id="matrix-selector-container"></div>
      <div class="form-group">
        <label>Поиск работы</label>
        <input id="matrix-search" class="input-ctrl" placeholder="Название работы...">
      </div>
      <div class="form-group">
        <label>Статус</label>
        <select id="matrix-filter-status" class="input-ctrl">
          <option value="">Все статусы</option>
          ${filterStatusOpts}
        </select>
      </div>
      <button class="btn" id="btn-undo">↩ Отменить</button>
      <button class="btn btn-excel" id="btn-export">📥 Excel</button>
    </div></div>
    <div class="matrix-scroll inverted-matrix" id="matrix-table-container">Выберите объект</div>`;
    
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
    
    document.getElementById('matrix-search').oninput = () => this.filterRows();
    document.getElementById('matrix-filter-status').onchange = (e) => {
      this.filterStatus = e.target.value;
      this.filterRows();
    };
    
    // Delegation for table cells
    document.getElementById('matrix-table-container').addEventListener('click', (e) => {
      const td = e.target.closest('td[data-key]');
      if (td) {
        const [configId, groupIdx, floorNum, workIdxStr, workType] = td.dataset.key.split('::');
        const workIdx = parseInt(workIdxStr);
        const cfg = store.getObjects().find(o => o.id === configId);
        if (!cfg) { 
          toast('Объект не найден','error'); 
          return; 
        }
        const floor = cfg.groups[parseInt(groupIdx)]?.floors.find(f => f.num === parseInt(floorNum));
        if (!floor) return;
        
        const workName = td.dataset.workname;
        const works = [...store.getDict('works'), ...store.getDict('worksMop')];
        const combinedWorkIdx = works.indexOf(workName);

        Drawer.open(configId, workName, parseInt(floorNum), floor, parseInt(groupIdx), combinedWorkIdx !== -1 ? combinedWorkIdx : workIdx, cfg, workType);
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
    
    const worksApts = store.getDict('works');
    const worksMop = store.getDict('worksMop');
    const worksAll = [...worksApts, ...worksMop];

    // Build headers (Columns = Floors)
    let groupHeaderHtml = '<tr><th class="sticky-col">Группа</th>';
    let floorHeaderHtml = '<tr><th class="sticky-col">Вид работы</th>';
    
    config.groups.forEach(g => {
      groupHeaderHtml += `<th colspan="${g.floors.length}" style="text-align:center; border-left:2px solid var(--border);">${escapeHTML(g.rawName)}</th>`;
      g.floors.forEach(f => {
        const label = f.num < 0 ? `П${f.num}` : `${f.num} эт.`;
        floorHeaderHtml += `<th style="${f === g.floors[0] ? 'border-left:2px solid var(--border);' : ''}">${escapeHTML(label)}</th>`;
      });
    });
    groupHeaderHtml += '</tr>';
    floorHeaderHtml += '</tr>';

    let html = `<table><thead>${groupHeaderHtml}${floorHeaderHtml}</thead><tbody>`;
    
    const buildRowsForWorks = (worksArray, worksLabel, combinedOffset) => {
      if (worksArray.length === 0) return '';
      let rowsHtml = `<tr class="work-group-header"><td colspan="${1 + config.groups.reduce((acc, g) => acc + g.floors.length, 0)}" style="background:var(--surface); font-weight:bold; color:var(--primary); padding-top:16px;">📁 ${worksLabel}</td></tr>`;
      
      worksArray.forEach((w, localIdx) => {
        const globalIdx = combinedOffset + localIdx;
        rowsHtml += `<tr class="matrix-row" data-work="${escapeHTML(w.toLowerCase())}">`;
        rowsHtml += `<td class="sticky-col">${escapeHTML(w)}</td>`;
        
        config.groups.forEach((g, gi) => {
          g.floors.forEach((f, fi) => {
            const key = `${config.id}_${gi}_${f.num}_${globalIdx}`;
            const t = store.getTask(key);
            
            const isMop = worksLabel === 'Работы в МОП';
            const totalEntities = isMop ? (f.mopZones || []).length : (f.apts || []).length;
            const doneEntities = isMop ? (t.mopDone || []).length : (t.aptsDone || []).length;
            const missing = totalEntities - doneEntities;
            
            const indicator = (totalEntities > 0 && missing > 0) ? `<span class="apt-indicator">${missing}</span>` : '';
            const borderStyle = fi === 0 ? 'border-left:2px solid var(--border);' : '';
            const workType = isMop ? 'mop' : 'apts';
            
            rowsHtml += `<td style="${borderStyle}" data-key="${escapeHTML(config.id)}::${gi}::${f.num}::${globalIdx}::${workType}" data-workname="${escapeHTML(w)}" data-status="${escapeHTML(t.text)}"><span class="status-badge ${t.status}">${escapeHTML(t.text)}${indicator}</span></td>`;
          });
        });
        rowsHtml += '</tr>';
      });
      return rowsHtml;
    };

    html += buildRowsForWorks(worksApts, 'Работы в квартирах', 0);
    html += buildRowsForWorks(worksMop, 'Работы в МОП', worksApts.length);
    
    html += '</tbody></table>';
    container.innerHTML = html;
    this.filterRows();
  },
  
  loadHouseSummary() {
    const house = this.activeHouse;
    const configs = store.getObjects().filter(o => o.house === house);
    const container = document.getElementById('matrix-table-container');
    
    if (configs.length === 0) { 
      container.innerHTML = '<p style="padding:40px;">Нет секций для выбранного дома</p>'; 
      return; 
    }
    
    const worksApts = store.getDict('works');
    const worksMop = store.getDict('worksMop');
    const worksAll = [...worksApts, ...worksMop];

    let html = '<table><thead><tr><th class="sticky-col">Вид работы</th>';
    configs.forEach(cfg => html += `<th>${escapeHTML(cfg.section)}</th>`);
    html += '</tr></thead><tbody>';
    
    const buildSummaryRows = (worksArray, worksLabel, combinedOffset) => {
      if (worksArray.length === 0) return '';
      let rowsHtml = `<tr class="work-group-header"><td colspan="${1 + configs.length}" style="background:var(--surface); font-weight:bold; color:var(--primary); padding-top:16px;">📁 ${worksLabel}</td></tr>`;
      
      worksArray.forEach((w, localIdx) => {
        const globalIdx = combinedOffset + localIdx;
        rowsHtml += `<tr class="matrix-row" data-work="${escapeHTML(w.toLowerCase())}">`;
        rowsHtml += `<td class="sticky-col">${escapeHTML(w)}</td>`;
        
        configs.forEach(cfg => {
          let done = 0, total = 0;
          cfg.groups.forEach(g => g.floors.forEach(f => {
            const key = `${cfg.id}_${cfg.groups.indexOf(g)}_${f.num}_${globalIdx}`;
            if (store.getTask(key).status === 's-done') done++;
            total++;
          }));
          const pct = total ? Math.round((done / total) * 100) : 0;
          const bg = pct === 100 ? 'var(--success)' : (pct > 0 ? 'var(--primary)' : 'var(--border)');
          const color = pct > 0 ? '#fff' : 'inherit';
          rowsHtml += `<td>
            <div style="font-size:0.8rem; margin-bottom:4px;">${done} / ${total}</div>
            <div style="height:6px; background:var(--border); border-radius:3px; overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:${bg};"></div>
            </div>
          </td>`;
        });
        rowsHtml += '</tr>';
      });
      return rowsHtml;
    };

    html += buildSummaryRows(worksApts, 'Работы в квартирах', 0);
    html += buildSummaryRows(worksMop, 'Работы в МОП', worksApts.length);
    
    html += '</tbody></table>';
    container.innerHTML = html;
    this.filterRows();
  },
  
  filterRows() {
    const q = (document.getElementById('matrix-search')?.value || '').toLowerCase();
    const filterStatus = this.filterStatus;

    document.querySelectorAll('.matrix-row').forEach(tr => {
      const workName = tr.dataset.work || '';
      const matchSearch = !q || workName.includes(q);
      
      let matchStatus = true;
      if (filterStatus && this.viewMode === 'detail') {
        // Если выбран фильтр по статусу, проверяем есть ли в строке хотя бы одна ячейка с таким статусом
        const cells = Array.from(tr.querySelectorAll('td[data-status]'));
        matchStatus = cells.some(td => td.dataset.status === filterStatus);
        
        // Визуально глушим ячейки, которые не подпадают под фильтр
        cells.forEach(td => {
          if (td.dataset.status !== filterStatus) {
            td.style.opacity = '0.2';
          } else {
            td.style.opacity = '1';
          }
        });
      } else {
        // Сброс прозрачности
        tr.querySelectorAll('td[data-status]').forEach(td => td.style.opacity = '1');
      }

      tr.style.display = (matchSearch && matchStatus) ? '' : 'none';
    });

    // Скрываем заголовки групп, если все их строки скрыты
    document.querySelectorAll('.work-group-header').forEach(hdr => {
      let next = hdr.nextElementSibling;
      let hasVisibleRows = false;
      while (next && next.classList.contains('matrix-row')) {
        if (next.style.display !== 'none') {
          hasVisibleRows = true;
          break;
        }
        next = next.nextElementSibling;
      }
      hdr.style.display = hasVisibleRows ? '' : 'none';
    });
  },
  
  exportExcel() {
    if (!window.XLSX) return toast('Библиотека Excel не загружена', 'error');
    const table = document.querySelector('#matrix-table-container table');
    if (!table) return toast('Нет данных для экспорта', 'error');
    window.XLSX.writeFile(window.XLSX.utils.table_to_book(table, { sheet: "Матрица ИД" }), "Матрица_ИД.xlsx");
  }
};
