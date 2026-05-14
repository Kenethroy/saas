import { z } from "zod";

const sortOrderSchema = z.enum(["asc", "desc"]);

function nullishToUndefined(value) {
  if (value === "" || value === null || value === "null" || value === "undefined") {
    return undefined;
  }
  return value;
}

export const applyStockAdjustmentSchema = z.object({
  productVariantId: z.coerce.number().int().positive(),
  quantityChange: z.coerce.number().int(),
  reason: z.string().trim().max(500).optional()
}).refine((value) => value.quantityChange !== 0, {
  message: "quantityChange must not be 0"
});

export const listInventoryTransactionsSchema = z.preprocess((value) => {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of [
    "page",
    "perPage",
    "search",
    "productId",
    "productVariantId",
    "transactionType",
    "referenceType",
    "sortOrder"
  ]) {
    input[key] = nullishToUndefined(input[key]);
  }

  return input;
}, z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(25),
  search: z.string().trim().min(1).optional(),
  productId: z.coerce.number().int().positive().optional(),
  productVariantId: z.coerce.number().int().positive().optional(),
  transactionType: z.coerce.number().int().positive().optional(),
  referenceType: z.string().trim().min(1).max(50).optional(),
  sortOrder: sortOrderSchema.default("desc")
}));
