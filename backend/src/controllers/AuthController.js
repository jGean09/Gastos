const authService = require('../services/AuthService');

class AuthController {
  async login(req, res) {
    try {
      const { who, password, mfaCode } = req.body;
      const result = await authService.login({ who, password, mfaCode });
      res.json(result);
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  }

  async verifyMfaLogin(req, res) {
    try {
      const { tempToken, mfaCode } = req.body;
      const result = await authService.verifyMfaLogin({ tempToken, mfaCode });
      res.json(result);
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  }

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      res.json(result);
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  }

  async setupMfa(req, res) {
    try {
      const result = await authService.setupMfa(req.user.who);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async verifyMfa(req, res) {
    try {
      const { secret, token } = req.body;
      const result = await authService.verifyAndEnableMfa(req.user.who, secret, token);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async disableMfa(req, res) {
    try {
      const { password } = req.body;
      const result = await authService.disableMfa(req.user.who, password);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(req.user.who, currentPassword, newPassword);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const result = await authService.logout(refreshToken);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }

  async me(req, res) {
    res.json({ user: req.user });
  }
}

module.exports = new AuthController();
