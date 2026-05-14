import { z } from "zod";

function normalizeQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (input.q === "" || input.q === null || input.q === "null" || input.q === "undefined") {
    input.q = undefined;
  }

  if (input.limit === "" || input.limit === null || input.limit === "null" || input.limit === "undefined") {
    input.limit = undefined;
  }

  return input;
}

export const globalSearchQuerySchema = z.preprocess(normalizeQuery, z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(8).default(4)
}));
