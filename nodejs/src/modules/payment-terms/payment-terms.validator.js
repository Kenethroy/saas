import { z } from "zod";

const booleanish = z.preprocess((value) => {
  if (value === "true" || value === "1" || value === 1) {
    return true;
  }

  if (value === "false" || value === "0" || value === 0) {
    return false;
  }

  return value;
}, z.boolean());

function normalizeListQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["search", "status"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

export const listPaymentTermsSchema = z.preprocess(normalizeListQuery, z.object({
  search: z.string().trim().optional(),
  status: booleanish.optional()
}));

export const createPaymentTermSchema = z.object({
  name: z.string().trim().min(1).max(100),
  days: z.coerce.number().int().min(0).default(0)
});

export const updatePaymentTermSchema = z.object({
  name: z.string().trim().min(1).max(100),
  days: z.coerce.number().int().min(0).default(0)
});
