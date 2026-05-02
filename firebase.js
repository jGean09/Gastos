import { initializeApp } from '[https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js](https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js)';
import { getFirestore } from '[https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js](https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js)';

const firebaseConfig = {
  apiKey: "AIzaSyBuiykuiner0QGtalcKhdvsBqFDy95pn2Y",
  authDomain: "gastos-casal-26c77.firebaseapp.com",
  projectId: "gastos-casal-26c77",
  storageBucket: "gastos-casal-26c77.firebasestorage.app",
  messagingSenderId: "848606367047",
  appId: "1:848606367047:web:f2b1243d4e2043239a9062"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);