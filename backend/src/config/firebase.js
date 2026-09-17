const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');

dotenv.config();

// ── Padrão Singleton: Garante uma única instância da conexão com o banco ──
class FirebaseApp {
  constructor() {
    if (FirebaseApp._instance) {
      return FirebaseApp._instance;
    }
    try {
      if (process.env.FIREBASE_CREDENTIALS_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON);
        initializeApp({ credential: cert(serviceAccount) });
      } else {
        initializeApp(); // Usa as credenciais padrão do ambiente
      }
      this.db = getFirestore();
      console.log('✅ Firebase Admin inicializado com sucesso.');
    } catch (error) {
      console.error('❌ Erro ao inicializar o Firebase Admin:', error.message);
      process.exit(1);
    }
    FirebaseApp._instance = this;
  }

  getDb() {
    return this.db;
  }
}

const instance = new FirebaseApp();
const db = instance.getDb();

module.exports = { db };
