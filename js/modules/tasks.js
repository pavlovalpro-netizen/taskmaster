import { store } from '../store.js';
import { escapeHTML, linkify, toast, CustomDialog } from '../utils.js';
import { Auth } from '../auth.js';

export const TasksModule = {
  currentFilter: 'active',
  currentSort: 'date-desc',
  searchQuery: '',
  filterByAssignee: null, // null = все, строка = uid инженера
  filterObject: '',
  filterHouse: '',
  
  render() {
    const isAdmin = Auth.userRole === 'admin';
    
    let assigneesOptions = '<option value="">Не назначен (личная)</option>';
    if (isAdmin && Auth.usersList) {
      assigneesOptions += Auth.usersList
        .filter(u => u.role === 'engineer')
        .map(u => `<option value="${escapeHTML(u.id)}">${escapeHTML(u.name || u.email)}</option>`)
        .join('');
    }

    let objectsOptions = '<option value="">Все объекты</option>';
    let housesOptions = '<option value="">Все дома</option>';
    const objs = store.getDict('objects');
    const houses = store.getDict('houses');
    if (objs.length) objectsOptions += objs.map(o => `<option value="${escapeHTML(o)}" ${this.filterObject === o ? 'selected' : ''}>${escapeHTML(o)}</option>`).join('');
    if (houses.length) housesOptions += houses.map(h => `<option value="${escapeHTML(h)}" ${this.filterHouse === h ? 'selected' : ''}>${escapeHTML(h)}</option>`).join('');

    // Блок фильтров по инженерам (только для Админа)
    let engineerFiltersHtml = '';
    if (isAdmin && Auth.usersList) {
      const engineers = Auth.usersList.filter(u => u.role === 'engineer');
      if (engineers.length > 0) {
        engineerFiltersHtml = `
          <h4 style="margin: 16px 0 8px; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">По исполнителю</h4>
          <button class="filter-btn ${!this.filterByAssignee ? 'active' : ''}" data-assignee="">Все задачи</button>
          ${engineers.map(u => `
            <button class="filter-btn ${this.filterByAssignee === u.id ? 'active' : ''}" data-assignee="${escapeHTML(u.id)}">
              Исполнитель: ${escapeHTML(u.name || u.email.split('@')[0])}
            </button>
          `).join('')}
        `;
      }
    }

    const addTaskForm = `
      <div class="form-row" style="margin-bottom: 16px; flex-wrap: wrap;">
        <input id="new-task-title" class="input-ctrl" placeholder="Название задачи" style="flex: 2; min-width: 200px;">
        <select id="new-task-object" class="input-ctrl" style="flex: 1; min-width: 120px;">
          <option value="">Без объекта</option>
          ${objs.map(o => `<option value="${escapeHTML(o)}">${escapeHTML(o)}</option>`).join('')}
        </select>
        <select id="new-task-house" class="input-ctrl" style="flex: 1; min-width: 120px;">
          <option value="">Без дома</option>
          ${houses.map(o => `<option value="${escapeHTML(o)}">${escapeHTML(o)}</option>`).join('')}
        </select>
        <input id="new-task-link" class="input-ctrl" placeholder="Ссылка (необязательно)" style="flex: 1; min-width: 150px;">
        <input id="new-task-deadline" class="input-ctrl" type="date" style="width: auto;">
        <select id="new-task-priority" class="input-ctrl" style="width: auto;">
          <option value="low">Низкий</option>
          <option value="normal" selected>Обычный</option>
          <option value="high">Высокий</option>
          <option value="critical">Критический</option>
        </select>
        ${isAdmin ? `<select id="new-task-assignee" class="input-ctrl" style="width: auto;">${assigneesOptions}</select>` : ''}
        <button class="btn btn-primary" id="btn-add-task">Добавить</button>
      </div>
    `;

    const html = `
    <div style="display: flex; gap: 20px; height: 100%; align-items: flex-start;">
      <!-- Боковая панель фильтров -->
      <div class="card tasks-sidebar">
        <h4 style="margin-bottom: 8px; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Объект</h4>
        <select id="filter-task-object" class="input-ctrl" style="margin-bottom: 12px; padding: 6px 10px; font-size: 0.8rem;">
          ${objectsOptions}
        </select>
        <h4 style="margin-bottom: 8px; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Дом</h4>
        <select id="filter-task-house" class="input-ctrl" style="margin-bottom: 12px; padding: 6px 10px; font-size: 0.8rem;">
          ${housesOptions}
        </select>

        <h4 style="margin-bottom: 8px; font-size: 0.75rem; color: var(--text-secondary); text-transform: uppercase;">Статус</h4>
        <div class="filter-list">
          <button class="filter-btn ${this.currentFilter === 'active' ? 'active' : ''}" data-filter="active">Все активные</button>
          <button class="filter-btn ${this.currentFilter === 'today' ? 'active' : ''}" data-filter="today">На сегодня</button>
          <button class="filter-btn ${this.currentFilter === 'tomorrow' ? 'active' : ''}" data-filter="tomorrow">На завтра</button>
          <button class="filter-btn ${this.currentFilter === 'week' ? 'active' : ''}" data-filter="week">На неделю</button>
          <button class="filter-btn ${this.currentFilter === 'overdue' ? 'active' : ''}" data-filter="overdue">Просроченные</button>
          <button class="filter-btn ${this.currentFilter === 'important' ? 'active' : ''}" data-filter="important">Важные</button>
          <button class="filter-btn ${this.currentFilter === 'completed' ? 'active' : ''}" data-filter="completed">Выполненные</button>
        </div>
        ${engineerFiltersHtml}
      </div>

      <!-- Основная область -->
      <div class="card" style="flex: 1; display: flex; flex-direction: column; gap: 16px;">
        <div class="form-row" style="background: var(--bg); padding: 12px; border-radius: var(--radius); border: 1px solid var(--border);">
          <div class="form-group" style="flex: 2;">
            <input id="tasks-search" class="input-ctrl" placeholder="Поиск задач..." value="${escapeHTML(this.searchQuery)}">
          </div>
          <div class="form-group" style="flex: 1; min-width: 200px;">
            <select id="tasks-sort" class="input-ctrl">
              <option value="date-desc" ${this.currentSort === 'date-desc' ? 'selected' : ''}>Сначала новые</option>
              <option value="date-asc" ${this.currentSort === 'date-asc' ? 'selected' : ''}>Сначала старые</option>
              <option value="deadline" ${this.currentSort === 'deadline' ? 'selected' : ''}>По срочности</option>
              <option value="priority" ${this.currentSort === 'priority' ? 'selected' : ''}>По важности</option>
            </select>
          </div>
        </div>

        ${addTaskForm}

        <div id="tasks-list" style="display: flex; flex-direction: column; gap: 8px;">
          ${this.renderTasksList()}
        </div>
      </div>
    </div>`;
    
    document.getElementById('tab-tasks').innerHTML = html;
    this.attachEvents();
  },

  getFilteredAndSortedTasks() {
    let tasks = store.getTasksTodo();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrow = today + 86400000;
    const nextWeek = today + 7 * 86400000;

    // Фильтр по исполнителю (только для Админа)
    if (this.filterByAssignee !== null && this.filterByAssignee !== '') {
      tasks = tasks.filter(t => t.assigneeId === this.filterByAssignee);
    }

    if (this.filterObject) tasks = tasks.filter(t => t.object === this.filterObject);
    if (this.filterHouse) tasks = tasks.filter(t => t.house === this.filterHouse);

    tasks = tasks.filter(t => {
      if (this.searchQuery && !t.title.toLowerCase().includes(this.searchQuery.toLowerCase())) return false;
      const isCompleted = t.completed;
      let taskDate = null;
      if (t.deadline) {
        const d = new Date(t.deadline);
        taskDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      }
      switch (this.currentFilter) {
        case 'active': return !isCompleted;
        case 'completed': return isCompleted;
        case 'today': return !isCompleted && taskDate === today;
        case 'tomorrow': return !isCompleted && taskDate === tomorrow;
        case 'week': return !isCompleted && taskDate >= today && taskDate <= nextWeek;
        case 'overdue': return !isCompleted && taskDate !== null && taskDate < today;
        case 'important': return !isCompleted && (t.priority === 'high' || t.priority === 'critical');
        default: return true;
      }
    });

    const priorityWeight = { 'critical': 4, 'high': 3, 'normal': 2, 'low': 1 };
    tasks.sort((a, b) => {
      if (this.currentSort === 'date-desc') return new Date(b.date) - new Date(a.date);
      if (this.currentSort === 'date-asc') return new Date(a.date) - new Date(b.date);
      if (this.currentSort === 'priority') {
        const pA = priorityWeight[a.priority || 'normal'];
        const pB = priorityWeight[b.priority || 'normal'];
        return pA !== pB ? pB - pA : new Date(b.date) - new Date(a.date);
      }
      if (this.currentSort === 'deadline') {
        if (!a.deadline && !b.deadline) return new Date(b.date) - new Date(a.date);
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      }
      return 0;
    });
    return tasks;
  },

  renderTasksList() {
    const tasks = this.getFilteredAndSortedTasks();
    if (tasks.length === 0) return `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">Нет задач</div>`;
    return tasks.map(task => this.renderCompactTask(task)).join('');
  },
  
  attachEvents() {
    document.getElementById('btn-add-task')?.addEventListener('click', () => this.addTask());
    
    // Фильтры по статусу
    document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
      btn.onclick = () => { this.currentFilter = btn.dataset.filter; this.render(); };
    });

    // Фильтры по исполнителю
    document.querySelectorAll('.filter-btn[data-assignee]').forEach(btn => {
      btn.onclick = () => { this.filterByAssignee = btn.dataset.assignee || null; this.render(); };
    });

    document.getElementById('filter-task-object')?.addEventListener('change', (e) => {
      this.filterObject = e.target.value;
      this.render();
    });
    document.getElementById('filter-task-house')?.addEventListener('change', (e) => {
      this.filterHouse = e.target.value;
      this.render();
    });

    document.getElementById('tasks-search').oninput = (e) => {
      this.searchQuery = e.target.value.trim();
      document.getElementById('tasks-list').innerHTML = this.renderTasksList();
    };

    document.getElementById('tasks-sort').onchange = (e) => { this.currentSort = e.target.value; this.render(); };

    document.getElementById('tasks-list').addEventListener('change', (e) => {
      if (e.target.classList.contains('task-complete')) this.toggleTask(e.target.dataset.id, e.target.checked);
    });

    document.getElementById('tasks-list').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn && btn.classList.contains('btn-open-task')) { this.openTaskModal(btn.dataset.id); return; }
      if (e.target.type !== 'checkbox' && e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
        const item = e.target.closest('.task-item');
        if (item) { const id = item.querySelector('.task-complete').dataset.id; this.openTaskModal(id); }
      }
    });
  },
  
  renderCompactTask(task) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    let deadlineBadge = '';
    if (task.deadline) {
      const d = new Date(task.deadline);
      const taskDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const overdue = taskDate < today && !task.completed;
      const isToday = taskDate === today && !task.completed;
      deadlineBadge = `<span class="deadline-badge ${overdue ? 'deadline-overdue' : (isToday ? 'deadline-today' : '')}">Срок: ${new Date(task.deadline).toLocaleDateString()}</span>`;
    }

    const priorityLabels = { 'low': 'Низкий', 'normal': 'Обычный', 'high': 'Высокий', 'critical': 'Критический' };
    const priorityBadge = `<span class="priority-badge badge-${task.priority || 'normal'}">${priorityLabels[task.priority || 'normal']}</span>`;
    
    let assigneeLabel = '';
    if (Auth.userRole === 'admin' && task.assigneeId && Auth.usersList) {
      const u = Auth.usersList.find(x => x.id === task.assigneeId);
      if (u) assigneeLabel = `<span class="task-assignee-badge">👤 ${escapeHTML(u.name || u.email.split('@')[0])}</span>`;
    }

    const isPersonal = task.authorId === Auth.currentUser.uid && !task.assigneeId;
    const personalBadge = isPersonal ? `<span style="font-size: 0.72rem; color: var(--text-secondary);">🔒 Личная</span>` : '';

    const subtasksTotal = task.subtasks ? task.subtasks.length : 0;
    const subtasksDone = task.subtasks ? task.subtasks.filter(s => s.done).length : 0;
    let commentsTotal = task.comments ? task.comments.length : 0;
    if (task.subtasks) task.subtasks.forEach(sub => { if (sub.comments) commentsTotal += sub.comments.length; });

    return `
    <div class="task-item compact-task ${task.completed ? 'completed' : ''}" style="cursor: pointer;">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; width: 100%;">
        <input type="checkbox" class="task-complete" data-id="${escapeHTML(task.id)}" ${task.completed ? 'checked' : ''}>
        <strong class="task-title" style="font-size: 1rem;">${escapeHTML(task.title)}</strong>
        ${priorityBadge}${deadlineBadge}${assigneeLabel}${personalBadge}
        <div style="margin-left: auto; display: flex; gap: 10px; align-items: center;">
          ${task.link ? `<a href="${escapeHTML(task.link)}" target="_blank" class="task-link-badge">🔗 Ссылка</a>` : ''}
          <span style="font-size: 0.8rem; color: var(--text-secondary);">📁 ${subtasksDone}/${subtasksTotal}</span>
          <span style="font-size: 0.8rem; color: var(--text-secondary);">💬 ${commentsTotal}</span>
          <button class="btn btn-sm btn-open-task" data-id="${escapeHTML(task.id)}">Открыть</button>
        </div>
      </div>
    </div>`;
  },
  
  addTask() {
    const title = document.getElementById('new-task-title').value.trim();
    if (!title) return toast('Введите название', 'error');
    const link = document.getElementById('new-task-link').value.trim();
    const deadline = document.getElementById('new-task-deadline').value;
    const priority = document.getElementById('new-task-priority').value;
    const object = document.getElementById('new-task-object').value;
    const house = document.getElementById('new-task-house').value;
    let assigneeId = null;
    if (Auth.userRole === 'admin') {
      assigneeId = document.getElementById('new-task-assignee').value || null;
    }
    store.addTaskTodo({
      id: Date.now().toString(),
      title, link: link || null, deadline: deadline || null,
      priority: priority || 'normal', assigneeId, object, house,
      authorId: Auth.currentUser.uid,
      date: new Date().toISOString(),
      completed: false, subtasks: [], comments: []
    });
    document.getElementById('new-task-title').value = '';
    document.getElementById('new-task-link').value = '';
    document.getElementById('new-task-object').value = '';
    document.getElementById('new-task-house').value = '';
    this.render();
  },
  
  toggleTask(id, completed) {
    const tasks = store.getTasksTodo();
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    task.completed = completed;
    store.updateTaskTodo(id, task);
    if (completed && task.authorId !== Auth.currentUser.uid) {
      store.logActivity("выполнил задачу", task.title);
    }
    this.render();
  },

  openTaskModal(taskId) {
    const tasks = store.getTasksTodo();
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (!task.subtasks) task.subtasks = [];
    if (!task.comments) task.comments = [];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'task-modal-card';
    modal.innerHTML = this.getTaskModalHTML(task);
    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    const closeModal = () => { overlay.remove(); modal.remove(); this.render(); };
    overlay.onclick = closeModal;
    modal.querySelector('.btn-close-modal').onclick = closeModal;
    this.attachModalEvents(modal, task);
  },

  getTaskModalHTML(task) {
    const priorityLabels = { 'low': 'Низкий', 'normal': 'Обычный', 'high': 'Высокий', 'critical': 'Критический' };
    const priorityBadge = `<span class="priority-badge badge-${task.priority || 'normal'}">${priorityLabels[task.priority || 'normal']}</span>`;
    const dateStr = task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Без срока';

    let assigneeLabel = '';
    let assigneeUid = null;
    if (task.assigneeId && Auth.usersList) {
      const u = Auth.usersList.find(x => x.id === task.assigneeId);
      if (u) { 
        assigneeUid = u.id;
        assigneeLabel = `<span style="font-size: 0.85rem; background: var(--bg); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border);">Исполнитель: ${escapeHTML(u.name || u.email)}</span>`; 
      }
    }

    const canDelete = task.authorId === Auth.currentUser.uid;
    const isOwnerOrAdmin = canDelete || Auth.userRole === 'admin';

    const renderComments = (comments) => {
      if (!comments || comments.length === 0) return '';
      return `<div class="task-comments-list">${comments.map(c => `
        <div class="task-comment-item">
          <div class="task-comment-text">${linkify(c.text)}</div>
          <div class="task-comment-date">${new Date(c.date).toLocaleString()}</div>
        </div>`).join('')}</div>`;
    };

    const renderSubtasks = () => {
      if (task.subtasks.length === 0) return '<div style="color:var(--text-secondary); font-size:0.9rem; margin-bottom:12px;">Нет шагов.</div>';
      return task.subtasks.map((sub, idx) => `
        <div class="task-modal-subtask ${sub.done ? 'done' : ''}">
          <div style="display:flex; align-items:flex-start; gap:8px;">
            <input type="checkbox" class="modal-subtask-check" data-subid="${escapeHTML(sub.id)}" ${sub.done ? 'checked' : ''} style="margin-top:4px;">
            <div style="flex:1;">
              <strong style="font-size:0.95rem;">${idx + 1}. ${escapeHTML(sub.text)}</strong>
              <button class="btn-text btn-add-subcomment" data-subid="${escapeHTML(sub.id)}">Комментировать шаг</button>
              ${isOwnerOrAdmin ? `
                <button class="btn-text btn-edit-subtask" data-subid="${escapeHTML(sub.id)}">Изменить</button>
                ${idx > 0 ? `<button class="btn-text btn-move-up" data-subid="${escapeHTML(sub.id)}">Вверх</button>` : ''}
                ${idx < task.subtasks.length - 1 ? `<button class="btn-text btn-move-down" data-subid="${escapeHTML(sub.id)}">Вниз</button>` : ''}
                <button class="btn-text btn-delete-subtask" data-subid="${escapeHTML(sub.id)}" style="color:var(--danger);">Удалить</button>
              ` : ''}
            </div>
          </div>
          <div style="margin-left: 24px; margin-top: 8px;">${renderComments(sub.comments || [])}</div>
        </div>`).join('');
    };

    return `
      <div class="task-modal-header">
        <h2 style="font-size: 1.4rem; margin-bottom: 8px;">${escapeHTML(task.title)}</h2>
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
          ${priorityBadge}
          <span class="deadline-badge">Срок: ${dateStr}</span>
          ${assigneeLabel}
          ${task.link ? `<a href="${escapeHTML(task.link)}" target="_blank" class="task-link-badge">Открыть ссылку</a>` : ''}
          ${isOwnerOrAdmin ? `<button class="btn-text btn-edit-task-main">Изменить название/срок</button>` : ''}
        </div>
        <button class="btn btn-icon btn-close-modal" style="position:absolute; top:20px; right:20px;">✕</button>
      </div>
      <div class="task-modal-body">
        <div class="task-modal-section">
          <h3>Декомпозиция (Шаги)</h3>
          <div class="subtasks-wrapper">${renderSubtasks()}</div>
          ${isOwnerOrAdmin ? `<div style="margin-top:12px; display:flex; gap:8px;">
            <input type="text" id="modal-new-subtask-input" class="input-ctrl" placeholder="Новый шаг..." style="flex:1;">
            <button class="btn btn-primary" id="modal-add-subtask">Добавить шаг</button>
          </div>` : ''}
        </div>
        <div class="task-modal-section" style="margin-top:24px;">
          <h3>Общие комментарии</h3>
          ${renderComments(task.comments)}
          <div style="margin-top:12px; display:flex; gap:8px; align-items:flex-start;">
            <textarea id="modal-new-comment-input" class="input-ctrl" placeholder="Текст комментария (можно ссылки)..." style="flex:1; height:80px; resize:vertical;"></textarea>
            <button class="btn btn-primary" id="modal-add-comment">Написать</button>
          </div>
        </div>
      </div>
      <div class="task-modal-footer">
        ${canDelete ? `<button class="btn btn-danger" id="modal-delete-task">Удалить задачу</button>` : `<div></div>`}
        <button class="btn ${task.completed ? '' : 'btn-success'}" id="modal-toggle-task">
          ${task.completed ? 'Вернуть в работу' : 'Завершить задачу'}
        </button>
      </div>`;
  },

  attachModalEvents(modal, task) {
    // Получаем assigneeId для уведомлений
    const assigneeId = task.assigneeId || null;
    const isAdminAction = Auth.userRole === 'admin';

    const updateTask = () => {
      store.updateTaskTodo(task.id, task);
      modal.innerHTML = this.getTaskModalHTML(task);
      this.attachModalEvents(modal, task);
    };

    modal.querySelector('#modal-delete-task')?.addEventListener('click', async () => {
      if (await CustomDialog.confirm('Точно удалить эту задачу?')) {
        store.deleteTaskTodo(task.id);
        modal.querySelector('.btn-close-modal').click();
      }
    });

    modal.querySelector('#modal-toggle-task').onclick = () => {
      task.completed = !task.completed;
      store.updateTaskTodo(task.id, task);
      if (task.completed && task.authorId !== Auth.currentUser.uid) {
        store.logActivity("выполнил задачу", task.title);
      }
      updateTask();
    };

    const addSubtaskBtn = modal.querySelector('#modal-add-subtask');
    const addSubtaskInput = modal.querySelector('#modal-new-subtask-input');
    if (addSubtaskBtn && addSubtaskInput) {
      const addSubtask = () => {
        const text = addSubtaskInput.value.trim();
        if (text) {
          task.subtasks.push({ id: Date.now().toString(), text, done: false, comments: [] });
          store.updateTaskTodo(task.id, task);
          // Если Админ добавил шаг — уведомить инженера
          if (isAdminAction && assigneeId) {
            store.notifyUser(assigneeId, `Администратор добавил новый шаг: "${text}"`, task.title);
          } else if (!isAdminAction) {
            store.logActivity("добавил новый шаг к задаче", task.title);
          }
          updateTask();
        }
      };
      addSubtaskBtn.onclick = addSubtask;
      addSubtaskInput.onkeypress = (e) => { if (e.key === 'Enter') addSubtask(); };
    }

    modal.querySelector('#modal-add-comment').onclick = () => {
      const text = modal.querySelector('#modal-new-comment-input').value.trim();
      if (text) {
        task.comments.push({ id: Date.now().toString(), text, date: new Date().toISOString() });
        store.updateTaskTodo(task.id, task);
        if (isAdminAction && assigneeId) {
          store.notifyUser(assigneeId, `Администратор оставил комментарий к задаче`, task.title);
        } else if (!isAdminAction) {
          store.logActivity("оставил комментарий к задаче", task.title);
        }
        updateTask();
      }
    };

    modal.querySelector('.task-modal-body').addEventListener('click', async (e) => {
      if (e.target.classList.contains('modal-subtask-check')) {
        const sub = task.subtasks.find(s => s.id === e.target.dataset.subid);
        if (sub) {
          sub.done = e.target.checked;
          store.updateTaskTodo(task.id, task);
          if (sub.done && task.authorId !== Auth.currentUser.uid) {
            store.logActivity("выполнил один из шагов", task.title);
          }
          e.target.closest('.task-modal-subtask')?.classList.toggle('done', sub.done);
        }
      }
      if (e.target.classList.contains('btn-add-subcomment')) {
        const sub = task.subtasks.find(s => s.id === e.target.dataset.subid);
        if (sub) {
          const text = await CustomDialog.prompt(`Комментарий к шагу: "${escapeHTML(sub.text)}"`);
          if (text) {
            if (!sub.comments) sub.comments = [];
            sub.comments.push({ id: Date.now().toString(), text, date: new Date().toISOString() });
            store.updateTaskTodo(task.id, task);
            if (isAdminAction && assigneeId) {
              store.notifyUser(assigneeId, `Администратор прокомментировал шаг: "${sub.text}"`, task.title);
            } else if (!isAdminAction) {
              store.logActivity("прокомментировал шаг в задаче", task.title);
            }
            updateTask();
          }
        }
      }
      if (e.target.classList.contains('btn-edit-subtask')) {
        const sub = task.subtasks.find(s => s.id === e.target.dataset.subid);
        if (sub) {
          const newText = await CustomDialog.prompt(`Новое название шага:`, sub.text);
          if (newText && newText !== sub.text) {
            sub.text = newText;
            updateTask();
          }
        }
      }
      if (e.target.classList.contains('btn-move-up') || e.target.classList.contains('btn-move-down')) {
        const subId = e.target.dataset.subid;
        const idx = task.subtasks.findIndex(s => s.id === subId);
        if (idx !== -1) {
          const isUp = e.target.classList.contains('btn-move-up');
          if (isUp && idx > 0) {
            [task.subtasks[idx - 1], task.subtasks[idx]] = [task.subtasks[idx], task.subtasks[idx - 1]];
            updateTask();
          } else if (!isUp && idx < task.subtasks.length - 1) {
            [task.subtasks[idx + 1], task.subtasks[idx]] = [task.subtasks[idx], task.subtasks[idx + 1]];
            updateTask();
          }
        }
      }
      if (e.target.classList.contains('btn-delete-subtask')) {
        if (await CustomDialog.confirm('Удалить этот шаг?')) {
          task.subtasks = task.subtasks.filter(s => s.id !== e.target.dataset.subid);
          updateTask();
        }
      }
    });

    modal.querySelector('.btn-edit-task-main')?.addEventListener('click', async () => {
      const newTitle = await CustomDialog.prompt('Новое название задачи:', task.title);
      if (newTitle !== null && newTitle.trim() !== '') {
        task.title = newTitle.trim();
        // Мы не можем сделать prompt для даты нативным путем, поэтому спросим вторым
        const newDeadline = await CustomDialog.prompt('Новый дедлайн (в формате ГГГГ-ММ-ДД) или оставьте пустым:', task.deadline || '');
        if (newDeadline !== null) {
          task.deadline = newDeadline.trim() || null;
        }
        updateTask();
      }
    });
  }
};
