const { z } = require('zod');

const loginSchema = z.object({
  who: z.enum(['him', 'her']).optional(),
  password: z.string().min(1, 'A senha é obrigatória').max(128),
  mfaCode: z.string().max(10).optional(),
});

const mfaLoginSchema = z.object({
  tempToken: z.string().min(1, 'Token temporário é obrigatório'),
  mfaCode: z.string().length(6, 'O código MFA deve ter exatamente 6 dígitos').regex(/^\d{6}$/, 'Código MFA deve conter apenas números'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token não fornecido'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
  newPassword: z.string()
    .min(8, 'A nova senha deve ter no mínimo 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, 'Senha deve conter letras maiúsculas, minúsculas e pelo menos um número'),
});

const mfaVerifySchema = z.object({
  secret: z.string().min(16, 'Segredo TOTP inválido').max(128),
  token: z.string().length(6, 'O código de confirmação deve ter exatamente 6 dígitos').regex(/^\d{6}$/, 'Código deve conter apenas números'),
});

const mfaDisableSchema = z.object({
  password: z.string().min(1, 'Senha atual é obrigatória para desativar o MFA'),
});

module.exports = {
  loginSchema,
  mfaLoginSchema,
  refreshSchema,
  changePasswordSchema,
  mfaVerifySchema,
  mfaDisableSchema,
};
