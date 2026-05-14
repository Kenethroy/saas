import { z } from "zod";

export const listAccountsPayableSchema = z.object({
  page:       z.coerce.number().int().positive().optional().default(1),
  perPage:    z.coerce.number().int().positive().max(100).optional().default(15),
  search:     z.string().trim().optional().default(""),
  status:     z.enum(["unpaid", "partial", "paid", ""]).optional().default(""),
  supplierId: z.coerce.number().int().positive().optional(),
  overdue:    z.preprocess(v => v === 'true', z.boolean()).optional()
});

export const apParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const updateAccountsPayableSchema = z.object({
  dueDate: z.string().nullable().optional(),
  notes:   z.string().trim().max(2000).nullable().optional()
});
