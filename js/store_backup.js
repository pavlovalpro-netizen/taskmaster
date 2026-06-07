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
        works: ['Штукатурка стен', 'Стяжка пола', 'Электромонтаж'],
        worksMop: ['Покраска МОП', 'Плитка МОП'],
        mopZones: ['Коридор', 'Лифтовой холл', 'Лестничная клетка']
      },
      objects: [],
      tasks: {},
      tasksTodo: [],
      activityLog: [],       // Общий журнал (для Админа)
      userNotifications: {},  // { userId: [ { id, message, date, read } ] } — для инженеров
      extraWorks: []          // Доп. работы / Рекламации
    };
    this.listeners = new Map();
    this.unsubscribeStore = null;
    this.lastLogCount = 0;
    this.lastUserNotifCount = 0;
  }

  initRealtime() {
    if (!db) return;
    const docRef = doc(db, "appData", "mainStore");
    
    this.unsubscribeStore = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.activityLog) data.activityLog = [];
        if (!data.userNotifications) data.userNotifications = {};
        
        // Миграция: добавляем mopZones всем этажам, если их нет
        let needsSave = false;
        if (data.objects) {
          data.objects.forEach(obj => {
            if (obj.groups) {
              obj.groups.forEach(g => {
                if (g.floors) {
                  g.floors.forEach(f => {
                    if (!f.mopZones) {
                      f.mopZones = ['Коридор', 'Лифтовой холл', 'Лестничная клетка'];
                      needsSave = true;
                    }
                  });
                }
              });
            }
          });
        }
        
        this.db = data;
        if (needsSave) this.saveToFirebase();

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
    // Для Админа — счётчик общего лога
    if (Auth.userRole === 'admin') {
      const badge = document.getElementById('notif-badge');
      if (badge) {
        const newCount = this.db.activityLog.length;
        if (newCount > this.lastLogCount && this.lastLogCount !== 0) {
          const latest = this.db.activityLog[this.db.activityLog.length - 1];
          if (latest && latest.userId !== Auth.currentUser.uid) {
            toast(`Событие: ${latest.action} — "${latest.taskTitle}"`, 'info');
          }
        }
        this.lastLogCount = newCount;
        badge.style.display = newCount > 0 ? 'block' : 'none';
        badge.textContent = newCount > 99 ? '99+' : newCount;
      }
      return;
    }

    // Для Инженера — счётчик личных уведомлений
    if (Auth.userRole === 'engineer' && Auth.currentUser) {
      const uid = Auth.currentUser.uid;
      const myNotifs = (this.db.userNotifications[uid] || []).filter(n => !n.read);
      const newCount = myNotifs.length;
      
      const badge = document.getElementById('notif-badge');
      if (badge) {
        if (newCount > this.lastUserNotifCount && this.lastUserNotifCount !== 0) {
          toast('Новое уведомление от Администратора', 'info');
        }
        this.lastUserNotifCount = newCount;
        badge.style.display = newCount > 0 ? 'block' : 'none';
        badge.textContent = newCount > 99 ? '99+' : newCount;
      }
    }
  }

  // Лог для Админа (общий журнал — когда инженер делает действия)
  logActivity(action, taskTitle) {
    if (!this.db.activityLog) this.db.activityLog = [];
    const userName = Auth.currentUser.displayName || Auth.currentUser.email.split('@')[0];
    this.db.activityLog.push({
      id: Date.now().toString(),
      userId: Auth.currentUser.uid,
      userName,
      action,
      taskTitle,
      date: new Date().toISOString()
    });
    if (this.db.activityLog.length > 100) this.db.activityLog.shift();
    this.saveToFirebase();
  }

  // Направленное уведомление конкретному инженеру (от Админа)
  notifyUser(userId, message, taskTitle) {
    if (!this.db.userNotifications) this.db.userNotifications = {};
    if (!this.db.userNotifications[userId]) this.db.userNotifications[userId] = [];
    this.db.userNotifications[userId].push({
      id: Date.now().toString(),
      message,
      taskTitle,
      date: new Date().toISOString(),
      read: false
    });
    // Ограничиваем 50 уведомлениями
    if (this.db.userNotifications[userId].length > 50) {
      this.db.userNotifications[userId].shift();
    }
    this.saveToFirebase();
  }

  // Пометить все уведомления пользователя как прочитанные
  markNotificationsRead(userId) {
    if (!this.db.userNotifications || !this.db.userNotifications[userId]) return;
    this.db.userNotifications[userId].forEach(n => n.read = true);
    this.lastUserNotifCount = 0;
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
  setDict(cat, arr) { this.db.dict[cat] = arr; this.saveToFirebase(); }

  // --- Объекты ---
  getObjects() { return this.db.objects || []; }
  addObject(obj) { if(!this.db.objects) this.db.objects = []; this.db.objects.push(obj); this.saveToFirebase(); }
  updateObject(id, data) { if(!this.db.objects) return; const i = this.db.objects.findIndex(o => o.id === id); if (i !== -1) { this.db.objects[i] = data; this.saveToFirebase(); } }
  deleteObject(id) { if(!this.db.objects) return; this.db.objects = this.db.objects.filter(o => o.id !== id); this.saveToFirebase(); }

  // --- Матрица задач ---
  getTask(key) {
    if(!this.db.tasks) this.db.tasks = {};
    return this.db.tasks[key] || { status: 's-none', text: 'Не начато', aptsDone: [], l1: '', l2: '', l3: '', l4: '', lMain: '', remarks: [] };
  }
  setTask(key, data) { if(!this.db.tasks) this.db.tasks = {}; this.db.tasks[key] = data; this.saveToFirebase(); }
  undoLastTask() { toast("Отмена отключена в онлайн режиме", "warning"); return false; }

  // --- Пользователи ---
  async deleteUserProfile(userId) {
    if (!db) return;
    try {
      const { doc: fsDoc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
      await deleteDoc(fsDoc(db, "users", userId));
      // Также очищаем его уведомления
      if (this.db.userNotifications && this.db.userNotifications[userId]) {
        delete this.db.userNotifications[userId];
        this.saveToFirebase();
      }
      return true;
    } catch(e) {
      console.error(e);
      return false;
    }
  }

  // --- Доп. работы / Рекламации ---
  getExtraWorks() { return this.db.extraWorks || []; }

  saveExtraWork(work) {
    if (!this.db.extraWorks) this.db.extraWorks = [];
    const idx = this.db.extraWorks.findIndex(w => w.id === work.id);
    if (idx !== -1) {
      this.db.extraWorks[idx] = work; // Убновляем
    } else {
      this.db.extraWorks.push(work);  // Добавляем
    }
    this.saveToFirebase();
  }

  deleteExtraWork(id) {
    if (!this.db.extraWorks) return;
    this.db.extraWorks = this.db.extraWorks.filter(w => w.id !== id);
    this.saveToFirebase();
  }

  // --- Ежедневные задачи ---
  getTasksTodo() {
    if(!this.db.tasksTodo) this.db.tasksTodo = [];
    if (Auth.userRole === 'engineer') {
      return this.db.tasksTodo.filter(t => t.authorId === Auth.currentUser.uid || t.assigneeId === Auth.currentUser.uid);
    } else if (Auth.userRole === 'admin') {
      return this.db.tasksTodo.filter(t => t.authorId === Auth.currentUser.uid);
    }
    return this.db.tasksTodo;
  }

  addTaskTodo(task) { if(!this.db.tasksTodo) this.db.tasksTodo = []; this.db.tasksTodo.push(task); this.saveToFirebase(); }
  updateTaskTodo(id, data) { if(!this.db.tasksTodo) return; const idx = this.db.tasksTodo.findIndex(t => t.id === id); if (idx !== -1) { this.db.tasksTodo[idx] = data; this.saveToFirebase(); } }
  deleteTaskTodo(id) { if(!this.db.tasksTodo) return; this.db.tasksTodo = this.db.tasksTodo.filter(t => t.id !== id); this.saveToFirebase(); }

  // --- События ---
  on(event, cb) { if (!this.listeners.has(event)) this.listeners.set(event, []); this.listeners.get(event).push(cb); }
  emitAll() { ['dict', 'objects', 'tasks', 'tasksTodo'].forEach(event => { (this.listeners.get(event) || []).forEach(cb => cb()); }); }
}

export const store = new Store();
