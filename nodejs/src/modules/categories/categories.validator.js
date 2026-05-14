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

  for (const key of ["search", "status", "page", "perPage"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

export const listCategoriesSchema = z.preprocess(normalizeListQuery, z.object({
  search: z.string().trim().optional(),
  status: booleanish.optional(),
  page: z.coerce.number().int().positive().max(100000).optional(),
  perPage: z.coerce.number().int().positive().max(100).optional()
}));

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).nullable().optional()
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).nullable().optional()
});
