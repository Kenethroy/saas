import { z } from "zod";

const poStatusSchema = z.enum(["pending", "approved", "received", "cancelled"]);

const booleanishNullishString = (value) => {
  if (value === "" || value === null || value === "null" || value === "undefined") {
    return undefined;
  }
  return value;
};

export const listPurchaseOrdersSchema = z.preprocess((value) => {
  const input = value && typeof value === "object" ? { ...value } : {};
  for (const key of ["search", "status", "page", "perPage", "supplierId"]) {
    input[key] = booleanishNullishString(input[key]);
  }
  return input;
}, z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
  status: poStatusSchema.optional(),
  supplierId: z.coerce.number().int().positive().optional()
}));

export const createPurchaseOrderSchema = z.object({
  supplierId: z.coerce.number().int().positive(),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  paymentTermId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(
    z.object({
      productVariantId: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().positive(),
      unitCost: z.coerce.number().min(0).optional()
    })
  ).min(1, "At least one item is required")
});

export const updatePurchaseOrderSchema = createPurchaseOrderSchema;

export const purchaseOrderParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const updatePurchaseOrderStatusSchema = z.object({
  status: poStatusSchema
});

export const receivePurchaseOrderSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(
    z.object({
      id: z.coerce.number().int().positive(),
      receivedQuantity: z.coerce.number().int().min(0),
      receivedUnitCost: z.coerce.number().min(0)
    })
  ).min(1, "At least one item is required")
});
