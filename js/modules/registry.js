import { store } from '../store.js';
import { escapeHTML, CustomDialog } from '../utils.js';
import { UI } from '../ui.js';
import { appModules } from '../app.js';

export const Registry = {
  render() {
    const objects = store.getObjects();
    
    document.getElementById('tab-registry').innerHTML = objects.map(o => `
      <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
        <div><strong>${escapeHTML(o.name)} — ${escapeHTML(o.house)}</strong> (${escapeHTML(o.section)})</div>
        <div style="display:flex; gap: 8px;">
          <button class="btn btn-edit" data-id="${escapeHTML(o.id)}">✏️ Редактировать</button>
          <button class="btn btn-delete" data-id="${escapeHTML(o.id)}">🗑 Удалить</button>
        </div>
      </div>
    `).join('') || '<div class="card"><p>Реестр пуст</p></div>';

    // Delegation
    const tabRegistry = document.getElementById('tab-registry');
    
    // Remove old listeners to avoid duplicates on re-render
    tabRegistry.replaceWith(tabRegistry.cloneNode(true));
    document.getElementById('tab-registry').addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;
      
      if (target.classList.contains('btn-edit')) {
        this.edit(target.dataset.id);
      } else if (target.classList.contains('btn-delete')) {
        this.delete(target.dataset.id);
      }
    });
  },
  
  edit(id) {
    const obj = store.getObjects().find(o => o.id === id);
    if (!obj) return;
    
    // Передаем данные в Builder
    if (appModules.builder) {
      appModules.builder.groups = JSON.parse(JSON.stringify(obj.groups));
      UI.switchTab('builder', appModules);
      
      // Заполняем поля и показываем воркспейс
      setTimeout(() => {
        const bObj = document.getElementById('b-obj');
        const bHouse = document.getElementById('b-house');
        const bSec = document.getElementById('b-sec');
        
        if(bObj) bObj.value = obj.name;
        if(bHouse) bHouse.value = obj.house;
        if(bSec) bSec.value = obj.section;
        
        document.getElementById('b-workspace').style.display = 'block';
        appModules.builder.renderGroups();
        
        // Удаляем старый объект из реестра (так как он будет перезаписан новым при сохранении)
        // Но делаем это только при сохранении - логика Builder.saveObject это не учитывает.
        // Чтобы не дублировать логику, мы просто удаляем его сейчас
        store.deleteObject(id);
      }, 100);
    }
  },
  
  async delete(id) {
    if (await CustomDialog.confirm('Удалить этот объект из реестра?')) { 
      store.deleteObject(id); 
      this.render(); 
    }
  }
};
