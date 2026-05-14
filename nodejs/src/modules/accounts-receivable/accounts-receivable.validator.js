import { z } from "zod";

function normalizeListQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["search", "status", "page", "perPage", "customerId"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

export const listARSchema = z.preprocess(normalizeListQuery, z.object({
  search: z.string().trim().optional(),
  status: z.string().optional(),
  customerId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().max(100000).optional(),
  perPage: z.coerce.number().int().positive().max(100).optional()
}));

export const updateARSchema = z.object({
  amount: z.coerce.number().min(0, "Amount must be non-negative").optional(),
  dueDate: z.string().nullable().optional(),
  agentId: z.coerce.number().int().positive().nullable().optional(),
  status: z.enum(["unpaid", "partial", "paid"]).optional()
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field is required to update"
});
