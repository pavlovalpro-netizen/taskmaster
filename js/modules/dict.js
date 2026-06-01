import { store } from '../store.js';
import { toast, escapeHTML } from '../utils.js';

export const Dict = {
  render() {
    document.getElementById('tab-dict').innerHTML = `
    <div class="card">
      <h3>📚 Справочники</h3>
      <div style="display:flex; gap:8px; margin:12px 0;">
        <button class="btn" id="btn-template">📥 Шаблон Excel</button>
        <button class="btn btn-primary" id="btn-import">📤 Импорт Excel</button>
        <input type="file" id="excelInput" accept=".xlsx" hidden>
      </div>
      <div style="display:grid; grid-template-columns: repeat(5,1fr); gap:12px;">
        ${[
          {id: 'objects', label: 'Объекты'},
          {id: 'houses', label: 'Дома'},
          {id: 'sections', label: 'Секции'},
          {id: 'works', label: 'Работы (Квартиры)'},
          {id: 'worksMop', label: 'Работы (МОП)'}
        ].map(cat => `
          <div>
            <strong>${escapeHTML(cat.label)}</strong>
            <textarea id="ta-${cat.id}" rows="6" class="input-ctrl" style="font-size:0.8rem; margin-top: 8px;"></textarea>
            <button class="btn" data-cat="${cat.id}" data-action="add" style="margin-top: 4px; font-size: 0.75rem;">+ Добавить</button>
          </div>
        `).join('')}
      </div>
    </div>`;
    
    this.refreshLists();
    
    document.getElementById('btn-template').onclick = () => {
      if (!window.XLSX) return toast('Библиотека Excel не загружена', 'error');
      const wb = window.XLSX.utils.book_new();
      ['objects','houses','sections','works','worksMop'].forEach(s => window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet([[s]]), s));
      window.XLSX.writeFile(wb, "Справочники_шаблон.xlsx");
    };
    
    document.getElementById('btn-import').onclick = () => document.getElementById('excelInput').click();
    document.getElementById('excelInput').onchange = (e) => this.importExcel(e);
    
    document.querySelectorAll('[data-action="add"]').forEach(btn => {
      btn.onclick = () => {
        const cat = btn.dataset.cat;
        const ta = document.getElementById(`ta-${cat}`);
        const items = ta.value.split('\n').filter(v => v.trim());
        items.push('Новый элемент');
        store.setDict(cat, items);
        this.refreshLists();
      };
    });
    
    document.querySelectorAll('textarea[id^="ta-"]').forEach(ta => {
      ta.onchange = () => {
        const cat = ta.id.replace('ta-', '');
        store.setDict(cat, ta.value.split('\n').filter(v => v.trim()));
      };
    });
  },
  
  refreshLists() {
    ['objects','houses','sections','works','worksMop'].forEach(cat => {
      const el = document.getElementById(`ta-${cat}`);
      if(el) el.value = store.getDict(cat).join('\n');
    });
  },
  
  importExcel(e) {
    if (!window.XLSX) return toast('Библиотека Excel не загружена', 'error');
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = window.XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        ['objects','houses','sections','works','worksMop'].forEach(sheet => {
          if (wb.Sheets[sheet]) {
            const data = window.XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1 })
              .slice(1).map(r => r[0]).filter(v => v);
            store.setDict(sheet, [...new Set([...store.getDict(sheet), ...data])]);
          }
        });
        this.refreshLists();
        toast('Импортировано успешно', 'success');
      } catch (err) {
        toast('Ошибка при чтении Excel', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }
};
