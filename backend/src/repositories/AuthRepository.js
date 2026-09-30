const bcrypt = require('bcryptjs');
const { db } = require('../config/firebase');

const BCRYPT_ROUNDS = 12;

class AuthRepository {
  constructor() {
    this.authRef = db.collection('config').doc('auth');
    this.settingsRef = db.collection('config').doc('settings');
  }

  /**
   * Carrega os dados de autenticação. Se não existirem, migra senhas legadas
   * existentes em config/settings ou inicializa os perfis padrão com hash seguro.
   */
  async loadOrCreateAuth() {
    const snap = await this.authRef.get();
    if (snap.exists) {
      return snap.data();
    }

    // Tenta migrar dados legados de config/settings
    const settingsSnap = await this.settingsRef.get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};

    const legacyPassHim = settings.password || '15112018';
    const legacyPassHer = settings.passwordHer || '';

    const hashHim = await bcrypt.hash(legacyPassHim, BCRYPT_ROUNDS);
    const hashHer = legacyPassHer ? await bcrypt.hash(legacyPassHer, BCRYPT_ROUNDS) : null;

    const initialAuth = {
      profiles: {
        him: {
          name: settings.him || 'Eu',
          passwordHash: hashHim,
          role: 'admin',
          mfaEnabled: false,
          mfaSecret: null,
        },
        her: {
          name: settings.her || 'Ela',
          passwordHash: hashHer,
          role: 'user',
          mfaEnabled: false,
          mfaSecret: null,
        },
      },
      createdAt: Date.now(),
      migratedFromLegacy: true,
    };

    await this.authRef.set(initialAuth);

    // Remove senhas legadas em texto plano de config/settings para evitar vazamentos
    if (settings.password || settings.passwordHer) {
      const sanitizedSettings = { ...settings };
      delete sanitizedSettings.password;
      delete sanitizedSettings.passwordHer;
      await this.settingsRef.set(sanitizedSettings);
    }

    return initialAuth;
  }

  async updateProfile(who, fields) {
    const fieldUpdates = {};
    for (const [key, value] of Object.entries(fields)) {
      fieldUpdates[`profiles.${who}.${key}`] = value;
    }
    fieldUpdates['updatedAt'] = Date.now();
    // Garante que o documento exista antes de usar update()
    const snap = await this.authRef.get();
    if (!snap.exists) await this.loadOrCreateAuth();
    await this.authRef.update(fieldUpdates);
    return (await this.authRef.get()).data().profiles[who];
  }

  async getProfile(who) {
    const authData = await this.loadOrCreateAuth();
    return authData.profiles ? authData.profiles[who] : null;
  }

  // ──────────────────────────────────────────────
  //  BLOCKLIST DE TOKENS REVOGADOS (Logout seguro)
  // ──────────────────────────────────────────────

  /**
   * Revoga um refresh token adicionando-o à blocklist com TTL de 7 dias.
   * Usa a sub-coleção `config/auth/revoked_tokens` para isolamento.
   */
  async revokeRefreshToken(tokenId, expiresAt) {
    const col = this.authRef.collection('revoked_tokens');
    await col.doc(tokenId).set({
      revokedAt: Date.now(),
      expiresAt, // timestamp Unix ms — usado para limpeza futura
    });
  }

  /**
   * Verifica se um token está na blocklist.
   */
  async isTokenRevoked(tokenId) {
    const col = this.authRef.collection('revoked_tokens');
    const snap = await col.doc(tokenId).get();
    return snap.exists;
  }
}

module.exports = new AuthRepository();
