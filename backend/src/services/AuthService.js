const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const authRepo = require('../repositories/AuthRepository');
const { JWT_SECRET, JWT_EXPIRATION, REFRESH_TOKEN_EXPIRATION } = require('../config/jwt');
const { encrypt, decrypt } = require('../utils/crypto');

class AuthService {
  /**
   * Realiza login autenticando por senha e checando MFA quando habilitado.
   * Suporta especificar `who` ('him' ou 'her') ou descobrir automaticamente pela senha.
   */
  async login({ who, password, mfaCode }) {
    if (!password) {
      throw new Error('A senha é obrigatória.');
    }

    const authData = await authRepo.loadOrCreateAuth();
    const profiles = authData.profiles;

    let matchedWho = who;
    let matchedProfile = null;

    if (matchedWho && profiles[matchedWho]) {
      const isMatch = profiles[matchedWho].passwordHash
        ? await bcrypt.compare(password, profiles[matchedWho].passwordHash)
        : false;
      if (isMatch) matchedProfile = profiles[matchedWho];
    } else {
      // Tenta correspondência automática nas senhas de ambos os perfis
      for (const [key, prof] of Object.entries(profiles)) {
        if (prof.passwordHash && (await bcrypt.compare(password, prof.passwordHash))) {
          matchedWho = key;
          matchedProfile = prof;
          break;
        }
      }
    }

    if (!matchedProfile) {
      throw new Error('Senha incorreta! Tente novamente.');
    }

    // ── Validação de MFA se habilitado ──
    if (matchedProfile.mfaEnabled) {
      if (!mfaCode) {
        // Gera um token temporário de 5 minutos exclusivo para a etapa do MFA
        const tempToken = jwt.sign(
          { who: matchedWho, step: 'mfa_required' },
          JWT_SECRET,
          { expiresIn: '5m' }
        );
        return {
          mfaRequired: true,
          who: matchedWho,
          name: matchedProfile.name,
          tempToken,
          message: 'Digite o código de 6 dígitos do seu aplicativo autenticador.',
        };
      }

      const plainSecret = decrypt(matchedProfile.mfaSecret);
      const verified = speakeasy.totp.verify({
        secret: plainSecret,
        encoding: 'base32',
        token: mfaCode.trim(),
        window: 1, // Tolera 30s de dessincronização de relógio
      });

      if (!verified) {
        throw new Error('Código de autenticação MFA inválido ou expirado.');
      }
    }

    return this._generateTokens(matchedWho, matchedProfile);
  }

  /**
   * Conclui o login de um usuário que forneceu o código MFA após o primeiro passo.
   */
  async verifyMfaLogin({ tempToken, mfaCode }) {
    if (!tempToken || !mfaCode) {
      throw new Error('Token temporário e código MFA são obrigatórios.');
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      throw new Error('Sessão temporária expirada. Faça login novamente.');
    }

    if (decoded.step !== 'mfa_required') {
      throw new Error('Token inválido para esta operação.');
    }

    const profile = await authRepo.getProfile(decoded.who);
    if (!profile || !profile.mfaEnabled || !profile.mfaSecret) {
      throw new Error('MFA não configurado para este usuário.');
    }

    const plainSecret = decrypt(profile.mfaSecret);
    const verified = speakeasy.totp.verify({
      secret: plainSecret,
      encoding: 'base32',
      token: mfaCode.trim(),
      window: 1,
    });

    if (!verified) {
      throw new Error('Código MFA incorreto! Verifique no seu autenticador.');
    }

    return this._generateTokens(decoded.who, profile);
  }

  /**
   * Renova o Access Token usando um Refresh Token válido.
   * Rejeita tokens que foram revogados via logout.
   */
  async refreshToken(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token não fornecido.');
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET);
    } catch {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (decoded.type !== 'refresh') {
      throw new Error('Token inválido.');
    }

    // Verifica blocklist: token foi revogado por logout?
    const tokenId = decoded.jti;
    if (tokenId && await authRepo.isTokenRevoked(tokenId)) {
      throw new Error('Sessão encerrada. Faça login novamente.');
    }

    const profile = await authRepo.getProfile(decoded.who);
    if (!profile) {
      throw new Error('Usuário não encontrado.');
    }

    const accessToken = jwt.sign(
      {
        id: decoded.who,
        who: decoded.who,
        name: profile.name,
        role: profile.role || 'user',
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    return {
      accessToken,
      user: {
        who: decoded.who,
        name: profile.name,
        role: profile.role || 'user',
        mfaEnabled: !!profile.mfaEnabled,
      },
    };
  }

  /**
   * Encerra a sessão revogando o refresh token no banco.
   * Mesmo que o attacker tenha o token, ele não poderá renová-lo.
   */
  async logout(refreshToken) {
    if (!refreshToken) return { success: true }; // já sem token, logout ok

    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET);
      if (decoded.jti) {
        // Calcula quando o token expira (para TTL da blocklist)
        const expiresAt = decoded.exp * 1000;
        await authRepo.revokeRefreshToken(decoded.jti, expiresAt);
      }
    } catch {
      // Token já expirado — revogar não é necessário
    }

    return { success: true, message: 'Sessão encerrada com sucesso.' };
  }

  /**
   * Inicia a configuração do MFA gerando a chave TOTP e o QR Code em Base64.
   */
  async setupMfa(who) {
    const profile = await authRepo.getProfile(who);
    if (!profile) throw new Error('Perfil não encontrado.');

    const secret = speakeasy.generateSecret({
      name: `Gastos Casal (${profile.name || who})`,
      length: 20,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCodeDataUrl,
      otpauthUrl: secret.otpauth_url,
    };
  }

  /**
   * Valida o primeiro código TOTP e confirma a ativação do MFA.
   */
  async verifyAndEnableMfa(who, secret, token) {
    if (!secret || !token) throw new Error('Segredo e código são obrigatórios.');

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: token.trim(),
      window: 1,
    });

    if (!verified) {
      throw new Error('Código de confirmação inválido. Tente novamente.');
    }

    // Criptografa o segredo TOTP em repouso com AES-256-GCM antes de persistir
    const encryptedSecret = encrypt(secret);

    await authRepo.updateProfile(who, {
      mfaSecret: encryptedSecret,
      mfaEnabled: true,
    });

    return { success: true, message: 'Autenticação em 2 fatores (MFA) ativada com sucesso!' };
  }

  /**
   * Desativa o MFA mediante confirmação de senha.
   */
  async disableMfa(who, password) {
    const profile = await authRepo.getProfile(who);
    if (!profile) throw new Error('Perfil não encontrado.');

    const isMatch = await bcrypt.compare(password, profile.passwordHash);
    if (!isMatch) {
      throw new Error('Senha incorreta! Não foi possível desativar o MFA.');
    }

    await authRepo.updateProfile(who, {
      mfaSecret: null,
      mfaEnabled: false,
    });

    return { success: true, message: 'Autenticação em 2 fatores desativada com sucesso.' };
  }

  /**
   * Altera a senha do usuário com hash bcrypt.
   */
  async changePassword(who, currentPassword, newPassword) {
    // Política da spec: mínimo 8 caracteres com maiúsculas, minúsculas e números
    const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!newPassword || !STRONG_PASSWORD.test(newPassword)) {
      throw new Error('Senha fraca: mínimo 8 caracteres com letras maiúsculas, minúsculas e pelo menos um número.');
    }

    const profile = await authRepo.getProfile(who);
    if (!profile) throw new Error('Perfil não encontrado.');

    if (profile.passwordHash) {
      const isMatch = await bcrypt.compare(currentPassword, profile.passwordHash);
      if (!isMatch) {
        throw new Error('Senha atual incorreta.');
      }
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await authRepo.updateProfile(who, { passwordHash: newHash });

    return { success: true, message: 'Senha alterada com sucesso!' };
  }

  _generateTokens(who, profile) {
    const payload = {
      id: who,
      who,
      name: profile.name,
      role: profile.role || 'user',
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
    // jti (JWT ID) único por token — necessário para revogar via blocklist no logout
    const refreshToken = jwt.sign(
      { who, type: 'refresh', jti: require('crypto').randomUUID() },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRATION }
    );

    return {
      accessToken,
      refreshToken,
      user: {
        who,
        name: profile.name,
        role: profile.role || 'user',
        mfaEnabled: !!profile.mfaEnabled,
      },
    };
  }
}

module.exports = new AuthService();
