import { store } from '../store.js';
import { toast, escapeHTML } from '../utils.js';
import { UI } from '../ui.js';
import { appModules } from '../app.js'; 

export const Builder = {
  groups: [],
  
  render() {
    document.getElementById('tab-builder').innerHTML = `
    <div class="card"><div class="form-row">
      <div class="form-group"><label>Объект</label><select id="b-obj" class="input-ctrl"></select></div>
      <div class="form-group"><label>Дом</label><select id="b-house" class="input-ctrl"></select></div>
      <div class="form-group" style="flex-direction:row; align-items:center; gap:8px; min-width:auto; margin-bottom:8px;">
        <input type="checkbox" id="b-has-sec" checked style="width:16px;height:16px;cursor:pointer;">
        <label for="b-has-sec" style="margin:0;cursor:pointer;">Есть секция</label>
      </div>
      <div class="form-group" id="b-sec-wrap"><label>Секция</label><select id="b-sec" class="input-ctrl"></select></div>
      <button class="btn btn-primary" id="btn-gen">Начать сборку</button>
    </div></div>
    <div class="card" id="b-workspace" style="display:none; margin-top: 16px;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>Настройка групп этажей</h3>
        <select id="b-mode" class="input-ctrl" style="width:auto; padding:6px 10px;">
          <option value="both">Квартиры и МОП</option>
          <option value="apts">Только Квартиры</option>
          <option value="mop">Только МОП</option>
        </select>
      </div>
      
      <div class="form-row" style="margin-top:12px; background:var(--bg); padding:12px; border-radius:var(--radius); border:1px solid var(--border);">
        <div class="form-group">
          <label>Диапазон этажей</label>
          <input id="b-floors" class="input-ctrl" placeholder="-1-17">
        </div>
        <div class="form-group">
          <label>Название группы</label>
          <select id="b-gname-select" class="input-ctrl">
            <option value="Подвал">Подвал</option>
            <option value="1 этаж">1 этаж</option>
            <option value="Типовые этажи" selected>Типовые этажи</option>
            <option value="custom">Свой вариант...</option>
          </select>
          <input id="b-gname-custom" class="input-ctrl hidden" placeholder="Введите название" style="margin-top: 8px;">
        </div>
        
        <!-- Поля для квартир -->
        <div class="form-group b-apt-field"><label>Кв. на этаже</label><input id="b-apts" class="input-ctrl" value="4" type="number" min="0"></div>
        <div class="form-group b-apt-field"><label>Начать с №</label><input id="b-start" class="input-ctrl" value="1" type="number" min="1"></div>
        
        <!-- Поля для МОП -->
        <div class="form-group b-mop-field" style="flex:2;">
          <label>Зоны МОП (выберите из справочника)</label>
          <div id="b-mop-zones-list" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; min-height:44px; max-height:120px; overflow-y:auto; padding:10px; border:1px solid var(--border); border-radius:4px; background:var(--surface);"></div>
        </div>
        
        <button class="btn btn-primary" id="btn-add-group" style="align-self:flex-end;">Добавить группу</button>
      </div>
      
      <div id="b-groups-list" style="margin-top:16px;"></div>
      <button class="btn btn-primary" style="width:100%;margin-top:16px;" id="btn-save">Сохранить в Реестр</button>
    </div>`;
    
    this.populateSelects();
    
    document.getElementById('b-has-sec').onchange = (e) => {
      document.getElementById('b-sec-wrap').style.display = e.target.checked ? 'flex' : 'none';
    };

    document.getElementById('btn-gen').onclick = () => { 
      document.getElementById('b-workspace').style.display = 'block'; 
      this.groups = []; 
      this.renderGroups(); 
    };
    
    document.getElementById('b-gname-select').onchange = (e) => {
      const custom = document.getElementById('b-gname-custom');
      e.target.value === 'custom' ? custom.classList.remove('hidden') : custom.classList.add('hidden');
    };

    document.getElementById('b-mode').onchange = (e) => this.toggleMode(e.target.value);
    
    document.getElementById('btn-add-group').onclick = () => this.addGroup();
    document.getElementById('btn-save').onclick = () => this.saveObject();
    
    document.getElementById('b-groups-list').addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-group')) {
        const index = parseInt(e.target.dataset.index);
        this.groups.splice(index, 1);
        this.renderGroups();
      }
      if (e.target.classList.contains('btn-edit-group')) {
        const index = parseInt(e.target.dataset.index);
        const g = this.groups[index];
        // Заполняем поля обратно
        const min = Math.min(...g.floors.map(f => f.num));
        const max = Math.max(...g.floors.map(f => f.num));
        document.getElementById('b-floors').value = `${min}-${max}`;
        document.getElementById('b-apts').value = g.aptsCount !== undefined ? g.aptsCount : (g.floors?.[0]?.apts?.length || 0);
        if (g.floors.length > 0 && g.floors[0].apts.length > 0) {
           document.getElementById('b-start').value = g.floors[0].apts[0];
        }
        
        // Устанавливаем МОП зоны
        const selectedMops = g.floors.length > 0 ? g.floors[0].mopZones : [];
        document.querySelectorAll('.b-mop-check').forEach(cb => {
          cb.checked = selectedMops.includes(cb.value);
        });

        this.groups.splice(index, 1);
        this.renderGroups();
        toast('Режим редактирования группы', 'info');
      }
    });
  },

  toggleMode(mode) {
    document.querySelectorAll('.b-apt-field').forEach(el => el.style.display = (mode === 'mop') ? 'none' : 'flex');
    document.querySelectorAll('.b-mop-field').forEach(el => el.style.display = (mode === 'apts') ? 'none' : 'flex');
  },
  
  populateSelects() {
    document.getElementById('b-obj').innerHTML = store.getDict('objects').map(o => `<option>${escapeHTML(o)}</option>`).join('');
    document.getElementById('b-house').innerHTML = store.getDict('houses').map(h => `<option>${escapeHTML(h)}</option>`).join('');
    document.getElementById('b-sec').innerHTML = store.getDict('sections').map(s => `<option>${escapeHTML(s)}</option>`).join('');
    
    const mopZones = store.getDict('mopZones');
    const container = document.getElementById('b-mop-zones-list');
    if (mopZones.length === 0) {
      container.innerHTML = '<span style="color:var(--text-secondary); font-size:0.8rem; font-style:italic;">Справочник пуст. Добавьте зоны МОП во вкладке "Справочники".</span>';
    } else {
      container.innerHTML = mopZones.map(z => `
        <label style="display:flex; align-items:center; gap:4px; font-size:0.8rem; cursor:pointer; background:var(--bg); padding:4px 8px; border-radius:4px; border: 1px solid var(--border);">
          <input type="checkbox" class="b-mop-check" value="${escapeHTML(z)}" checked> ${escapeHTML(z)}
        </label>
      `).join('');
    }
  },
  
  addGroup() {
    const input = document.getElementById('b-floors').value.trim();
    if (!input) return toast('Укажите диапазон этажей', 'error');

    let min, max;
    if (input.startsWith('-')) {
      const rest = input.substring(1);
      const parts = rest.split('-');
      min = -Number(parts[0]);
      max = parts.length > 1 ? Number(parts[1]) : min;
    } else {
      const parts = input.split('-');
      min = Number(parts[0]);
      max = parts.length > 1 ? Number(parts[1]) : min;
    }
    
    if (isNaN(min) || isNaN(max)) return toast('Неверный диапазон этажей', 'error');
    
    const mode = document.getElementById('b-mode').value;
    const aptsCount = mode === 'mop' ? 0 : (parseInt(document.getElementById('b-apts').value) || 0);
    let startNum = parseInt(document.getElementById('b-start').value) || 1;
    
    let mopZones = [];
    if (mode !== 'apts') {
      document.querySelectorAll('.b-mop-check:checked').forEach(cb => mopZones.push(cb.value));
    }

    const floors = [];
    for (let i = min; i <= max; i++) {
      if (i === 0) continue; // нулевого этажа не бывает
      const apts = [];
      if (aptsCount > 0) {
        for (let a = 0; a < aptsCount; a++) {
          apts.push(startNum++);
        }
      }
      floors.push({ num: i, apts, mopZones });
    }
    
    let groupName = document.getElementById('b-gname-select').value;
    if (groupName === 'custom') {
      groupName = document.getElementById('b-gname-custom').value || 'Моя группа';
    }
    
    this.groups.push({ name: groupName, rawName: groupName, floors, aptsCount });
    this.renderGroups();
    
    document.getElementById('b-floors').value = '';
    document.getElementById('b-start').value = startNum;
  },
  
  renderGroups() {
    document.getElementById('b-groups-list').innerHTML = this.groups.map((g, i) => `
      <div style="border-left:4px solid var(--primary); padding:10px 12px; margin:8px 0; background:var(--surface); border-radius:4px; border:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <div>
          <strong style="font-size:1rem;">${escapeHTML(g.name)}</strong> 
          <span style="color:var(--text-secondary); font-size:0.85rem; margin-left:8px;">(этажей: ${g.floors.length}, кв: ${g.aptsCount})</span>
        </div>
        <div>
          <button class="btn btn-sm btn-edit-group" data-index="${i}" style="margin-right:4px;">Изменить</button>
          <button class="btn btn-sm btn-delete-group" data-index="${i}" style="background:var(--danger); color:#fff; border:none;">Удалить</button>
        </div>
      </div>`).join('');
  },
  
  saveObject() {
    const obj = document.getElementById('b-obj').value;
    const house = document.getElementById('b-house').value;
    
    const hasSec = document.getElementById('b-has-sec').checked;
    const sec = hasSec ? document.getElementById('b-sec').value : '';
    
    if (!obj || !house || (hasSec && !sec)) return toast('Заполните обязательные поля (Объект, Дом' + (hasSec ? ', Секция' : '') + ')', 'error');
    if (!this.groups.length) return toast('Добавьте группы', 'error');
    
    const newConfigId = 'cfg_' + Date.now();
    
    store.addObject({ 
      id: newConfigId, 
      name: obj, 
      house, 
      section: sec, 
      groups: JSON.parse(JSON.stringify(this.groups)) 
    });
    
    toast('Объект сохранён в реестр', 'success');
    document.getElementById('b-workspace').style.display = 'none';
    this.groups = [];
    
    UI.switchTab('matrix', appModules);
    if (appModules.matrix) {
      appModules.matrix.activeConfigId = newConfigId;
      setTimeout(() => appModules.matrix.loadMatrix(), 50); 
    }
  }
};
