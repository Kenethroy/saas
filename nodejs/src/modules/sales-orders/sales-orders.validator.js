import { z } from "zod";

const discountTypeSchema = z.enum(["none", "percentage", "fixed"]);
const salesOrderStatusSchema = z.enum(["pending", "processing", "for_delivery", "delivered", "completed", "cancelled"]);

const booleanishNullishString = (value) => {
  if (value === "" || value === null || value === "null" || value === "undefined") {
    return undefined;
  }
  return value;
};

export const listSalesOrdersSchema = z.preprocess((value) => {
  const input = value && typeof value === "object" ? { ...value } : {};
  for (const key of ["search", "status", "page", "perPage"]) {
    input[key] = booleanishNullishString(input[key]);
  }
  return input;
}, z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
  status: salesOrderStatusSchema.optional()
}));

export const createSalesOrderSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  agentId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  paymentTermId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  discountType: discountTypeSchema.default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  items: z.array(
    z.object({
      productVariantId: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().positive(),
      unitPrice: z.coerce.number().min(0).optional(),
      discountPercent: z.coerce.number().min(0).max(100).optional().default(0)
    })
  ).min(1, "At least one item is required")
}).superRefine((value, ctx) => {
  if (value.discountType === "percentage" && (Number(value.discountValue) < 1 || Number(value.discountValue) > 100)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discountValue"],
      message: "Percentage discount must be between 1 and 100"
    });
  }

  value.items.forEach((item, index) => {
    if (Number(item.discountPercent ?? 0) !== 0 && (Number(item.discountPercent) < 1 || Number(item.discountPercent) > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "discountPercent"],
        message: "Item discount must be between 1 and 100"
      });
    }
  });
});

export const updateSalesOrderSchema = createSalesOrderSchema;

export const salesOrderParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const updateSalesOrderStatusSchema = z.object({
  status: salesOrderStatusSchema
});
