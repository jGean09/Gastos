const { z } = require('zod');

// Validação de ID do documento Firestore (alfanumérico, hífen ou underscore)
const idParamSchema = z.object({
  id: z.string().min(1, 'ID é obrigatório').max(100).regex(/^[a-zA-Z0-9_-]+$/, 'Formato de ID inválido'),
});

const receiptItemSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  name: z.string().min(1, 'Nome do item é obrigatório').max(200),
  priceCents: z.number().int().nonnegative('Preço deve ser positivo'),
  split: z.enum(['both', 'him', 'her', 'other']).optional(),
  otherName: z.string().max(100).optional(),
}).passthrough();

const createReceiptSchema = z.object({
  store: z.string().min(1, 'Nome do estabelecimento é obrigatório').max(150),
  date: z.string().min(1, 'Data é obrigatória').max(40),
  type: z.string().max(50).optional(),
  payer: z.enum(['him', 'her']).optional(),
  method: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  scope: z.enum(['household', 'individual']).optional(),
  status: z.enum(['open', 'paid']).optional(),
  items: z.array(receiptItemSchema).optional(),
  himCents: z.number().int().optional(),
  herCents: z.number().int().optional(),
  otherCents: z.number().int().optional(),
  coupleCents: z.number().int().optional(),
  totalCents: z.number().int().optional(),
  amountCents: z.number().int().optional(),
  imageBase64: z.string().nullable().optional(),
  imageMime: z.string().max(50).nullable().optional(),
  names: z.object({
    him: z.string().max(50).optional(),
    her: z.string().max(50).optional(),
  }).optional(),
  cycle: z.string().max(100).optional(),
  createdAt: z.number().optional(),
}).passthrough();

const updateReceiptSchema = createReceiptSchema.partial();

const toggleStatusSchema = z.object({
  currentStatus: z.enum(['open', 'paid'], {
    errorMap: () => ({ message: "O status atual deve ser 'open' ou 'paid'" }),
  }),
});

const closeCycleSchema = z.object({
  cycleName: z.string().min(1, 'Nome do ciclo é obrigatório').max(100),
  payer: z.enum(['him', 'her'], {
    errorMap: () => ({ message: "O pagador deve ser 'him' ou 'her'" }),
  }),
  amountPaid: z.number().int().nonnegative('Valor pago deve ser maior ou igual a zero'),
  date: z.string().min(1, 'Data é obrigatória').max(40),
  names: z.object({
    him: z.string().max(50).optional(),
    her: z.string().max(50).optional(),
  }).optional(),
});

const settingsSchema = z.object({
  him: z.string().max(50).optional(),
  her: z.string().max(50).optional(),
  monthlyGoal: z.number().nonnegative().optional(),
  geminiKey: z.string().max(200).optional(),
}).passthrough();

module.exports = {
  idParamSchema,
  createReceiptSchema,
  updateReceiptSchema,
  toggleStatusSchema,
  closeCycleSchema,
  settingsSchema,
};
