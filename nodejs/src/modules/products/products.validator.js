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

  if (input.categoryId === undefined && input.category_id !== undefined) {
    input.categoryId = input.category_id;
  }

  if (input.stockStatus === undefined && input.stock_status !== undefined) {
    input.stockStatus = input.stock_status;
  }

  for (const key of ["search", "categoryId", "status", "stockStatus", "page", "perPage", "context", "salesOrderId"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

function normalizeProductBody(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (input.categoryId === undefined && input.category_id !== undefined) {
    input.categoryId = input.category_id;
  }

  if (input.fileUrl === undefined && input.file_url !== undefined) {
    input.fileUrl = input.file_url;
  }

  if (typeof input.variants === "string") {
    try {
      input.variants = JSON.parse(input.variants);
    } catch {
      input.variants = input.variants;
    }
  }

  if (input.fileUrl === "") {
    input.fileUrl = null;
  }

  if (input.hasVariants === undefined && input.has_variants !== undefined) {
    input.hasVariants = input.has_variants;
  }

  return input;
}

const variantCreateShape = {
  name: z.string().trim().max(255).optional(),

  unitCost: z.coerce.number().nonnegative().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  stockQuantity: z.coerce.number().int().nonnegative().optional(),
  reorderLevel: z.coerce.number().int().nonnegative().optional(),
  status: booleanish.optional()
};

export const listProductsSchema = z.preprocess(normalizeListQuery, z.object({
  search: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  status: booleanish.optional(),
  page: z.coerce.number().int().positive().max(100000).optional(),
  perPage: z.coerce.number().int().positive().max(100).optional()
}));

export const listProductOptionsSchema = z.preprocess(normalizeListQuery, z.object({
  search: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  context: z.enum(["purchase_order", "sales_order"]).optional(),
  salesOrderId: z.coerce.number().int().positive().optional()
}));

export const listInventoryOverviewSchema = z.preprocess(normalizeListQuery, z.object({
  search: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  stockStatus: z.enum(["in_stock", "low_stock", "out_of_stock"]).optional(),
  page: z.coerce.number().int().positive().max(100000).optional(),
  perPage: z.coerce.number().int().positive().max(100).optional()
}));

export const createVariantSchema = z.object(variantCreateShape);

export const updateVariantSchema = z.object({
  name: z.string().trim().max(255).optional(),
  unitCost: z.coerce.number().nonnegative().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  stockQuantity: z.coerce.number().int().nonnegative().optional(),
  reorderLevel: z.coerce.number().int().nonnegative().optional(),
  status: booleanish.optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
});

export const createProductSchema = z.preprocess(normalizeProductBody, z.object({
  categoryId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(255),
  fileUrl: z.string().trim().max(500).nullable().optional(),
  status: booleanish.optional(),
  unitCost: z.coerce.number().nonnegative().optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  stockQuantity: z.coerce.number().int().nonnegative().optional(),
  reorderLevel: z.coerce.number().int().nonnegative().optional(),
  hasVariants: z.preprocess((val) => val === "true" || val === true || val === 1 || val === "1", z.boolean()).default(false),
  variants: z.array(createVariantSchema).optional()
}).superRefine((data, ctx) => {
  if (data.hasVariants && data.variants) {
    data.variants.forEach((v, i) => {
      if (!v.name || v.name.trim() === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Variant name is required for multi-variant products",
          path: ["variants", i, "name"],
        });
      }
    });
  }
}));

export const updateProductSchema = z.preprocess(normalizeProductBody, z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1).max(255).optional(),
  fileUrl: z.string().trim().max(500).nullable().optional(),
  status: booleanish.optional(),
  hasVariants: z.preprocess((val) => val === "true" || val === true || val === 1 || val === "1", z.boolean()).optional(),
  variants: z.array(z.any()).optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
}));
