import { z } from "zod";

const discountTypeSchema = z.enum(["none", "percentage", "fixed"]);
const quotationStatusSchema = z.enum(["draft", "sent", "accepted", "rejected", "expired", "converted"]);

const nullishString = (value) => {
  if (value === "" || value === null || value === "null" || value === "undefined") {
    return undefined;
  }

  return value;
};

const baseQuotationSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  contactPerson: z.string().trim().max(255).optional().nullable(),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  agentId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  paymentTermId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  discountType: discountTypeSchema.default("none"),
  discountValue: z.coerce.number().min(0).default(0),
  notes: z.string().trim().max(5000).optional().nullable(),
  status: quotationStatusSchema.optional(),
  items: z.array(
    z.object({
      productVariantId: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().positive(),
      unitPrice: z.coerce.number().min(0).optional(),
      discountPercent: z.coerce.number().min(0).max(100).default(0),
      description: z.string().trim().max(1000).optional().nullable()
    })
  ).min(1, "At least one item is required")
}).superRefine((value, ctx) => {
  if (value.validUntil <= value.quoteDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["validUntil"],
      message: "Valid until date must be after quotation date"
    });
  }

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

export const listQuotationsSchema = z.preprocess((value) => {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["search", "status", "customerId", "agentId", "page", "perPage"]) {
    input[key] = nullishString(input[key]);
  }

  return input;
}, z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
  status: quotationStatusSchema.optional(),
  customerId: z.coerce.number().int().positive().optional(),
  agentId: z.coerce.number().int().positive().optional()
}));

export const quotationParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const createQuotationSchema = baseQuotationSchema;

export const updateQuotationSchema = baseQuotationSchema;

export const updateQuotationStatusSchema = z.object({
  status: quotationStatusSchema
});
