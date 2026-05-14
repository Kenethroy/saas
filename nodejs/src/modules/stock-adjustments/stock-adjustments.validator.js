import { z } from "zod";

const statusSchema = z.enum(["draft", "pending", "approved", "rejected"]);
const sortOrderSchema = z.enum(["asc", "desc"]);

function nullishToUndefined(value) {
  if (value === "" || value === null || value === "null" || value === "undefined") {
    return undefined;
  }
  return value;
}

function normalizeBody(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (typeof input.items === "string") {
    try {
      input.items = JSON.parse(input.items);
    } catch {
      input.items = input.items;
    }
  }

  return input;
}

const adjustmentItemSchema = z.object({
  productVariantId: z.coerce.number().int().positive(),
  restockFlag: z
    .preprocess((value) => {
      if (value === true || value === false) return value;
      if (value === 1 || value === "1" || value === "true") return true;
      if (value === 0 || value === "0" || value === "false") return false;
      if (value === "" || value === null || value === undefined) return undefined;
      return value;
    }, z.boolean().optional())
    .optional(),
  quantityChange: z.coerce.number().int(),
  notes: z.string().trim().max(255).optional().nullable()
}).refine((value) => value.quantityChange !== 0, {
  message: "Item quantityChange must not be 0"
});

export const listStockAdjustmentsSchema = z.preprocess((value) => {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["page", "perPage", "search", "status", "reason", "sortOrder"]) {
    input[key] = nullishToUndefined(input[key]);
  }

  return input;
}, z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
  status: statusSchema.optional(),
  reason: z.string().trim().min(1).max(255).optional(),
  sortOrder: sortOrderSchema.default("desc")
}));

export const stockAdjustmentParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createStockAdjustmentSchema = z.preprocess(normalizeBody, z.object({
  adjustmentDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date" }).optional(),
  reason: z.string().trim().max(255).optional().nullable(),
  remarks: z.string().trim().max(5000).optional().nullable(),
  items: z.array(adjustmentItemSchema).min(1, "At least one item is required")
}));

export const updateStockAdjustmentSchema = createStockAdjustmentSchema;

export const rejectStockAdjustmentSchema = z.object({
  reason: z.string().trim().min(1).max(255)
});
