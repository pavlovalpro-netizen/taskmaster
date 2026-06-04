import { store } from '../store.js';
import { toast, escapeHTML, CustomDialog } from '../utils.js';

export const Dict = {
  render() {
    document.getElementById('tab-dict').innerHTML = `
    <div class="card">
      <h3>Справочники</h3>
      <div style="display:flex; gap:8px; margin:12px 0;">
        <button class="btn" id="btn-template">Шаблон Excel</button>
        <button class="btn btn-primary" id="btn-import">Импорт Excel</button>
        <button class="btn btn-danger" id="btn-clean-dict">Очистить неиспользуемые</button>
        <input type="file" id="excelInput" accept=".xlsx" hidden>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
        ${[
          {id: 'objects', label: 'Объекты'},
          {id: 'houses', label: 'Дома'},
          {id: 'sections', label: 'Секции'},
          {id: 'works', label: 'Работы (Квартиры)'},
          {id: 'worksMop', label: 'Работы (МОП)'},
          {id: 'mopZones', label: 'Зоны МОП'}
        ].map(cat => `
          <div class="dict-category" style="background: var(--bg); padding: 12px; border-radius: var(--radius); border: 1px solid var(--border);">
            <strong style="display:block; margin-bottom:8px;">${escapeHTML(cat.label)}</strong>
            <div id="list-${cat.id}" style="display:flex; flex-direction:column; gap:4px; max-height:250px; overflow-y:auto; margin-bottom:8px; font-size: 0.85rem;"></div>
            <div style="display:flex; gap:4px;">
              <input type="text" id="input-${cat.id}" class="input-ctrl" placeholder="Новый..." style="flex:1; padding: 4px 8px; font-size: 0.8rem;">
              <button class="btn btn-primary btn-sm" data-cat="${cat.id}" data-action="add">Добавить</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
    
    this.refreshLists();
    
    document.getElementById('btn-template').onclick = () => {
      if (!window.XLSX) return toast('Библиотека Excel не загружена', 'error');
      const wb = window.XLSX.utils.book_new();
      ['objects','houses','sections','works','worksMop','mopZones'].forEach(s => window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet([[s]]), s));
      window.XLSX.writeFile(wb, "Справочники_шаблон.xlsx");
    };
    
    document.getElementById('btn-import').onclick = () => document.getElementById('excelInput').click();
    document.getElementById('excelInput').onchange = (e) => this.importExcel(e);
    
    document.getElementById('btn-clean-dict').onclick = async () => {
      if (await CustomDialog.confirm("Удалить все неиспользуемые пункты из всех справочников?")) {
        let count = 0;
        ['objects','houses','sections','works','worksMop','mopZones'].forEach(cat => {
          const arr = store.getDict(cat);
          const filtered = arr.filter(val => this.isItemInUse(cat, val));
          count += (arr.length - filtered.length);
          if (arr.length !== filtered.length) store.setDict(cat, filtered);
        });
        this.refreshLists();
        toast(`Очищено ${count} неиспользуемых элементов.`, 'success');
      }
    };
    
    document.querySelectorAll('[data-action="add"]').forEach(btn => {
      btn.onclick = () => {
        const cat = btn.dataset.cat;
        const input = document.getElementById(`input-${cat}`);
        const val = input.value.trim();
        if (!val) return;
        const arr = store.getDict(cat);
        if (!arr.includes(val)) {
          arr.push(val);
          store.setDict(cat, arr);
          input.value = '';
          this.refreshLists();
        } else {
          toast('Такой элемент уже есть', 'warning');
        }
      };
    });

    document.getElementById('tab-dict').addEventListener('click', async (e) => {
      if (e.target.classList.contains('btn-del-dict')) {
        const cat = e.target.dataset.cat;
        const val = e.target.dataset.val;
        if (this.isItemInUse(cat, val)) {
          return toast(`Элемент "${val}" используется в реестре! Удаление запрещено.`, 'error');
        }
        if (await CustomDialog.confirm(`Точно удалить "${val}"?`)) {
          let arr = store.getDict(cat);
          arr = arr.filter(i => i !== val);
          store.setDict(cat, arr);
          this.refreshLists();
        }
      }
    });
  },
  
  isItemInUse(cat, val) {
    const objs = store.getObjects();
    if (objs.length === 0) return false;
    
    for (let o of objs) {
      if (cat === 'objects' && o.name === val) return true;
      if (cat === 'houses' && o.house === val) return true;
      if (cat === 'sections' && o.section === val) return true;
      
      if (cat === 'works' || cat === 'worksMop' || cat === 'mopZones') {
        // Мы проверяем сохраненные задачи (store.db.tasks)
        const tasksKeys = Object.keys(store.db.tasks || {});
        // Формат ключа cfgId_gi_fnum_globalIdx.
        // Чтобы точно знать, используется ли работа, можно проверить:
        // А используется ли она вообще в store.db.tasks Todo?
      }
    }
    
    // Глубокая проверка по задачам
    if (cat === 'works' || cat === 'worksMop') {
      const worksApts = store.getDict('works');
      const worksMop = store.getDict('worksMop');
      const combined = [...worksApts, ...worksMop];
      const targetIdx = combined.indexOf(val);
      if (targetIdx === -1) return false; // Если его нет, значит не юзается
      const tasksKeys = Object.keys(store.db.tasks || {});
      for (let key of tasksKeys) {
        if (key.endsWith(`_${targetIdx}`)) return true;
      }
    }

    if (cat === 'mopZones') {
      for (let o of objs) {
        if (o.groups) {
          for (let g of o.groups) {
            if (g.floors) {
              for (let f of g.floors) {
                if (f.mopZones && f.mopZones.includes(val)) return true;
              }
            }
          }
        }
      }
    }
    
    return false;
  },

  refreshLists() {
    ['objects','houses','sections','works','worksMop','mopZones'].forEach(cat => {
      const el = document.getElementById(`list-${cat}`);
      if(el) {
        const arr = store.getDict(cat);
        if (arr.length === 0) {
          el.innerHTML = '<span style="color:var(--text-secondary); font-style:italic;">Пусто</span>';
        } else {
          el.innerHTML = arr.map(val => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface); padding:4px 8px; border-radius:4px; border:1px solid var(--border);">
              <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:80%;" title="${escapeHTML(val)}">${escapeHTML(val)}</span>
              <button class="btn-text btn-del-dict" data-cat="${cat}" data-val="${escapeHTML(val)}" style="color:var(--danger); padding:0 4px; font-weight:bold;">✕</button>
            </div>
          `).join('');
        }
      }
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
        ['objects','houses','sections','works','worksMop','mopZones'].forEach(sheet => {
          if (wb.Sheets[sheet]) {
            const data = window.XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1 })
              .slice(1).map(r => String(r[0] || '').trim()).filter(v => v);
            store.setDict(sheet, [...new Set([...store.getDict(sheet), ...data])]);
          }
        });
        this.refreshLists();
        toast('Импортировано успешно (данные дополнены)', 'success');
      } catch (err) {
        toast('Ошибка при чтении Excel', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }
};
