import { store } from '../store.js';
import { toast, escapeHTML } from '../utils.js';
import { UI } from '../ui.js';
import { appModules } from '../app.js'; // Чтобы переключить вкладку

export const Builder = {
  groups: [],
  
  render() {
    document.getElementById('tab-builder').innerHTML = `
    <div class="card"><div class="form-row">
      <div class="form-group"><label>Объект</label><select id="b-obj" class="input-ctrl"></select></div>
      <div class="form-group"><label>Дом</label><select id="b-house" class="input-ctrl"></select></div>
      <div class="form-group"><label>Секция</label><select id="b-sec" class="input-ctrl"></select></div>
      <button class="btn btn-primary" id="btn-gen">Начать сборку</button>
    </div></div>
    <div class="card" id="b-workspace" style="display:none; margin-top: 16px;">
      <h3>Настройка групп</h3>
      <div class="form-row">
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
        <div class="form-group"><label>Кв. на этаже</label><input id="b-apts" class="input-ctrl" value="4" type="number" min="0"></div>
        <div class="form-group"><label>Начать с №</label><input id="b-start" class="input-ctrl" value="1" type="number" min="1"></div>
        <button class="btn btn-primary" id="btn-add-group">Добавить</button>
      </div>
      <div id="b-groups-list"></div>
      <button class="btn btn-primary" style="width:100%;margin-top:12px;" id="btn-save">💾 Сохранить в Реестр</button>
    </div>`;
    
    this.populateSelects();
    
    document.getElementById('btn-gen').onclick = () => { 
      document.getElementById('b-workspace').style.display = 'block'; 
      this.groups = []; 
      this.renderGroups(); 
    };
    
    document.getElementById('b-gname-select').onchange = (e) => {
      const custom = document.getElementById('b-gname-custom');
      e.target.value === 'custom' ? custom.classList.remove('hidden') : custom.classList.add('hidden');
    };
    
    document.getElementById('btn-add-group').onclick = () => this.addGroup();
    document.getElementById('btn-save').onclick = () => this.saveObject();
    
    // Делегирование для кнопок удаления групп
    document.getElementById('b-groups-list').addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-delete-group')) {
        const index = parseInt(e.target.dataset.index);
        this.groups.splice(index, 1);
        this.renderGroups();
      }
    });
  },
  
  populateSelects() {
    document.getElementById('b-obj').innerHTML = store.getDict('objects').map(o => `<option>${escapeHTML(o)}</option>`).join('');
    document.getElementById('b-house').innerHTML = store.getDict('houses').map(h => `<option>${escapeHTML(h)}</option>`).join('');
    document.getElementById('b-sec').innerHTML = store.getDict('sections').map(s => `<option>${escapeHTML(s)}</option>`).join('');
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
    
    const aptsCount = parseInt(document.getElementById('b-apts').value) || 0;
    let startNum = parseInt(document.getElementById('b-start').value) || 1;
    
    const floors = [];
    for (let i = min; i <= max; i++) {
      if (i === 0) continue; // нулевого этажа не бывает
      const apts = [];
      if (aptsCount > 0) {
        for (let a = 0; a < aptsCount; a++) {
          apts.push(startNum++);
        }
      }
      floors.push({ num: i, apts });
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
      <div style="border-left:4px solid var(--primary); padding:8px; margin:8px 0; background:var(--surface); border-radius:8px;">
        <strong>${escapeHTML(g.name)}</strong> (этажей: ${g.floors.length}, кв: ${g.aptsCount})
        <button class="btn btn-sm btn-delete-group" data-index="${i}" style="margin-left: 12px;">🗑 Удалить</button>
      </div>`).join('');
  },
  
  saveObject() {
    const obj = document.getElementById('b-obj').value;
    const house = document.getElementById('b-house').value;
    const sec = document.getElementById('b-sec').value;
    
    if (!obj || !house || !sec) return toast('Заполните все поля (объект, дом, секция)', 'error');
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
    
    // Переключим на вкладку матрицы, чтобы посмотреть результат
    UI.switchTab('matrix', appModules);
    // Автоматически выберем созданный объект
    if (appModules.matrix) {
      appModules.matrix.activeConfigId = newConfigId;
      setTimeout(() => appModules.matrix.loadMatrix(), 50); // Небольшая задержка, чтобы DOM обновился
    }
  }
};
