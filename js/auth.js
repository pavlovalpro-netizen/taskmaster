import { auth, db, googleProvider } from './firebase-config.js';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { toast } from './utils.js';

export const Auth = {
  currentUser: null,
  userRole: null, // 'admin' или 'engineer'
  usersList: [], // Кэш списка инженеров для админа

  init(onLoginCallback, onLogoutCallback) {
    if (!auth) {
      toast('Firebase не настроен! Проверьте firebase-config.js', 'error');
      return;
    }

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        this.currentUser = user;
        await this.loadUserRole(user);
        onLoginCallback(user, this.userRole);
      } else {
        this.currentUser = null;
        this.userRole = null;
        onLogoutCallback();
      }
    });

    this.attachEvents();
  },

  async loadUserRole(user) {
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        this.userRole = docSnap.data().role;
      } else {
        // Проверяем, есть ли приглашение в URL
        const urlParams = new URLSearchParams(window.location.search);
        const isInvite = urlParams.get('invite') === 'true';

        // Создаем профиль инженера по умолчанию
        this.userRole = 'engineer';
        await setDoc(docRef, { 
          role: 'engineer', 
          email: user.email,
          name: user.displayName || user.email.split('@')[0]
        });
        
        if (isInvite) {
          toast('Вы успешно присоединились по приглашению!', 'success');
          // Очищаем URL от параметра
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      if (this.userRole === 'admin') {
        await this.loadAllUsers();
      }
    } catch (error) {
      console.error("Ошибка получения роли:", error);
      this.userRole = 'engineer';
    }
  },

  async loadAllUsers() {
    try {
      const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
      const querySnapshot = await getDocs(collection(db, "users"));
      this.usersList = [];
      querySnapshot.forEach((doc) => {
        this.usersList.push({ id: doc.id, ...doc.data() });
      });
    } catch (error) {
      console.error("Ошибка загрузки пользователей:", error);
    }
  },

  attachEvents() {
    document.getElementById('btn-google-login')?.addEventListener('click', async () => {
      try {
        await signInWithPopup(auth, googleProvider);
        toast('Успешный вход через Google', 'success');
      } catch (error) {
        console.error(error);
        toast('Ошибка входа: ' + error.message, 'error');
      }
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      signOut(auth);
      toast('Вы вышли из системы', 'info');
    });
  }
};
