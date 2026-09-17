const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// ── Padrão Singleton: Garante uma única instância da conexão com o banco ──
class FirebaseApp {
  constructor() {
    if (FirebaseApp._instance) {
      return FirebaseApp._instance;
    }
    try {
      // Usa credenciais da variável de ambiente GOOGLE_APPLICATION_CREDENTIALS (arquivo JSON)
      // OU usa a variável FIREBASE_CREDENTIALS_JSON com o conteúdo do JSON em string
      if (process.env.FIREBASE_CREDENTIALS_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      } else {
        // Fallback: usa o arquivo indicado por GOOGLE_APPLICATION_CREDENTIALS
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
      }
      this.db = admin.firestore();
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
