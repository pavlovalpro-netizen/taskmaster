import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBY8cDJ_ahn7_B4eOdQDoo1Nn3yuE5CosI",
  authDomain: "task-b421a.firebaseapp.com",
  projectId: "task-b421a",
  storageBucket: "task-b421a.firebasestorage.app",
  messagingSenderId: "318727128974",
  appId: "1:318727128974:web:b8dadfd6250cf9ccc3c6df",
  measurementId: "G-D3P016HW86"
};

let app, auth, db, googleProvider;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  googleProvider = new GoogleAuthProvider();
  console.log("Firebase успешно инициализирован.");
} catch (error) {
  console.error("Ошибка инициализации Firebase:", error);
}

export { auth, db, googleProvider };
