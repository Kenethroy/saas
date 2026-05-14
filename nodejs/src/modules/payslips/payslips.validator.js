import { z } from "zod";

export const listPayslipsSchema = z.object({
  employee_id: z.coerce.number().int().positive().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["draft", "released"]).optional(),
  page: z.coerce.number().int().positive().max(100000).default(1),
  limit: z.coerce.number().int().positive().max(200).default(10)
});

export const createPayslipSchema = z.object({
  employee_id: z.coerce.number().int().positive(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pay_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  basic_pay: z.coerce.number().nonnegative().default(0),
  overtime_pay: z.coerce.number().nonnegative().default(0),
  allowances: z.coerce.number().nonnegative().default(0),
  deductions: z.coerce.number().nonnegative().default(0),
  notes: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(["draft", "released"]).optional().default("draft")
});

export const updatePayslipSchema = createPayslipSchema.partial().extend({
  status: z.enum(["draft", "released"]).optional()
});
