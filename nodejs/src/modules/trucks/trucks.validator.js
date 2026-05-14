import { z } from "zod";

const truckStatusSchema = z.enum(["active", "inactive", "maintenance"]);

function normalizeListQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["search", "status", "page", "perPage"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

export const listTrucksSchema = z.preprocess(
  normalizeListQuery,
  z.object({
    search: z.string().trim().optional(),
    status: truckStatusSchema.optional(),
    page: z.coerce.number().int().positive().max(100000).optional(),
    perPage: z.coerce.number().int().positive().max(100).optional()
  })
);

export const listTruckOptionsSchema = z.preprocess(
  normalizeListQuery,
  z.object({
    search: z.string().trim().optional()
  })
);

export const createTruckSchema = z.object({
  plateNumber: z.string().trim().min(1).max(50),
  model: z.string().trim().max(100).nullable().optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  year: z.coerce.number().int().min(1900).max(3000).nullable().optional(),
  color: z.string().trim().max(50).nullable().optional(),
  capacityKg: z.coerce.number().nonnegative().nullable().optional(),
  status: truckStatusSchema.optional(),
  notes: z.string().trim().max(5000).nullable().optional()
});

export const updateTruckSchema = z.object({
  plateNumber: z.string().trim().min(1).max(50).optional(),
  model: z.string().trim().max(100).nullable().optional(),
  brand: z.string().trim().max(100).nullable().optional(),
  year: z.coerce.number().int().min(1900).max(3000).nullable().optional(),
  color: z.string().trim().max(50).nullable().optional(),
  capacityKg: z.coerce.number().nonnegative().nullable().optional(),
  status: truckStatusSchema.optional(),
  notes: z.string().trim().max(5000).nullable().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
});
