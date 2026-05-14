import { z } from "zod";

function normalizeQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  const nullableKeys = ["q", "status", "subscriptionStatus"];
  for (const key of nullableKeys) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

export const platformAdminLoginSchema = z.object({
  credential: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(255)
});

export const platformAdminTenantsListQuerySchema = z.preprocess(normalizeQuery, z.object({
  q: z.string().trim().min(2).max(100).optional(),
  status: z.enum(["pending", "active", "inactive", "suspended", "cancelled"]).optional(),
  subscriptionStatus: z.enum(["incomplete", "trialing", "active", "past_due", "expired", "cancelled", "suspended"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
}));

