import { db } from './firebase-config.js';
import { doc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { toast } from './utils.js';
import { Auth } from './auth.js';

class Store {
  constructor() {
    this.db = {
      dict: { 
        objects: ['Молжаниново'], 
        houses: ['ЖД-1'], 
        sections: ['Секция 6'], 
        works: ['Штукатурка стен', 'Стяжка пола', 'Электромонтаж'] 
      },
      objects: [],
      tasks: {},
      tasksTodo: [],
      activityLog: [] // Журнал событий
    };
    this.listeners = new Map();
    this.unsubscribeStore = null;
    this.lastLogCount = 0; // Для бейджика непрочитанных
  }

  initRealtime() {
    if (!db) return;

    const docRef = doc(db, "appData", "mainStore");
    
    this.unsubscribeStore = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.activityLog) data.activityLog = [];
        this.db = data;
        
        this.checkNotifications();
        this.emitAll();
      } else {
        this.saveToFirebase();
      }
    }, (error) => {
      console.error("Ошибка синхронизации:", error);
      toast("Нет доступа к базе данных.", "error");
    });
  }

  checkNotifications() {
    if (Auth.userRole !== 'admin') return;
    
    // Обновляем счетчик непрочитанных в шапке
    const badge = document.getElementById('notif-badge');
    if (badge) {
      const newCount = this.db.activityLog.length;
      if (newCount > this.lastLogCount && this.lastLogCount !== 0) {
        // Проиграть звук или просто показать всплывашку для самого нового события
        const latest = this.db.activityLog[this.db.activityLog.length - 1];
        if (latest.userId !== Auth.currentUser.uid) {
          toast(`Новое событие: ${latest.action}`, 'info');
        }
      }
      this.lastLogCount = newCount;
      
      if (newCount > 0) {
        badge.style.display = 'block';
        badge.textContent = newCount > 99 ? '99+' : newCount;
      } else {
        badge.style.display = 'none';
      }
    }
  }

  logActivity(action, taskTitle) {
    if (!this.db.activityLog) this.db.activityLog = [];
    
    const userName = Auth.currentUser.displayName || Auth.currentUser.email.split('@')[0];
    
    this.db.activityLog.push({
      id: Date.now().toString(),
      userId: Auth.currentUser.uid,
      userName: userName,
      action: action,
      taskTitle: taskTitle,
      date: new Date().toISOString()
    });
    
    // Ограничиваем лог последними 100 событиями
    if (this.db.activityLog.length > 100) {
      this.db.activityLog.shift();
    }
    
    this.saveToFirebase();
  }

  clearActivityLog() {
    this.db.activityLog = [];
    this.lastLogCount = 0;
    this.saveToFirebase();
  }

  async saveToFirebase() {
    if (!db) return;
    try {
      await setDoc(doc(db, "appData", "mainStore"), this.db);
    } catch (error) {
      console.error("Ошибка сохранения:", error);
      toast("Ошибка сохранения данных", "error");
    }
  }

  // --- Справочники ---
  getDict(cat) { return this.db.dict[cat] || []; }
  setDict(cat, arr) { 
    this.db.dict[cat] = arr; 
    this.saveToFirebase(); 
  }

  // --- Объекты (Конфигурации) ---
  getObjects() { return this.db.objects || []; }
  addObject(obj) { 
    if(!this.db.objects) this.db.objects = [];
    this.db.objects.push(obj); 
    this.saveToFirebase(); 
  }
  updateObject(id, data) { 
    if(!this.db.objects) return;
    const i = this.db.objects.findIndex(o => o.id === id); 
    if (i !== -1) { 
      this.db.objects[i] = data; 
      this.saveToFirebase(); 
    } 
  }
  deleteObject(id) { 
    if(!this.db.objects) return;
    this.db.objects = this.db.objects.filter(o => o.id !== id); 
    this.saveToFirebase(); 
  }

  // --- Матрица задач ---
  getTask(key) { 
    if(!this.db.tasks) this.db.tasks = {};
    return this.db.tasks[key] || { 
      status: 's-none', 
      text: 'Не начато', 
      aptsDone: [], 
      l1: '', l2: '', l3: '', l4: '', lMain: '', 
      remarks: [] 
    }; 
  }
  setTask(key, data) {
    if(!this.db.tasks) this.db.tasks = {};
    this.db.tasks[key] = data; 
    this.saveToFirebase(); 
  }

  undoLastTask() { 
    toast("Отмена отключена в онлайн режиме", "warning");
    return false;
  }

  // --- Ежедневные задачи ---
  getTasksTodo() { 
    if(!this.db.tasksTodo) this.db.tasksTodo = [];
    
    if (Auth.userRole === 'engineer') {
      // Инженер видит свои личные задачи И задачи, назначенные ему админом
      return this.db.tasksTodo.filter(t => t.authorId === Auth.currentUser.uid || t.assigneeId === Auth.currentUser.uid);
    } else if (Auth.userRole === 'admin') {
      // Админ видит задачи, которые он сам создал. Личные задачи инженеров (где автор - инженер) он не видит.
      return this.db.tasksTodo.filter(t => t.authorId === Auth.currentUser.uid);
    }
    
    return this.db.tasksTodo; 
  }
  
  addTaskTodo(task) { 
    if(!this.db.tasksTodo) this.db.tasksTodo = [];
    this.db.tasksTodo.push(task); 
    this.saveToFirebase(); 
  }
  
  updateTaskTodo(id, data) { 
    if(!this.db.tasksTodo) return;
    const idx = this.db.tasksTodo.findIndex(t => t.id === id); 
    if (idx !== -1) { 
      this.db.tasksTodo[idx] = data; 
      this.saveToFirebase(); 
    } 
  }
  
  deleteTaskTodo(id) { 
    if(!this.db.tasksTodo) return;
    this.db.tasksTodo = this.db.tasksTodo.filter(t => t.id !== id); 
    this.saveToFirebase(); 
  }

  // --- События ---
  on(event, cb) { 
    if (!this.listeners.has(event)) this.listeners.set(event, []); 
    this.listeners.get(event).push(cb); 
  }
  
  emitAll() {
    ['dict', 'objects', 'tasks', 'tasksTodo'].forEach(event => {
      (this.listeners.get(event) || []).forEach(cb => cb()); 
    });
  }
}

export const store = new Store();
