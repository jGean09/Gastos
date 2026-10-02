const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
const { logger } = require('./logger');

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
      logger.info('✅ Firebase Admin inicializado com sucesso.');
    } catch (error) {
      logger.error({ err: error.message }, '❌ Erro ao inicializar o Firebase Admin');
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
