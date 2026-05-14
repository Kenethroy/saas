import { z } from "zod";

const customerReturnStatusSchema = z.enum(["draft", "pending", "approved", "completed", "rejected"]);
const sortOrderSchema = z.enum(["asc", "desc"]);
const sortableFieldSchema = z.enum(["created_at", "updated_at", "request_date", "status", "rma_number"]);

function nullishToUndefined(value) {
  if (value === "" || value === null || value === "null" || value === "undefined") {
    return undefined;
  }
  return value;
}

function normalizeNullableId(value) {
  if (value === "" || value === null || value === "null" || value === "undefined") {
    return null;
  }
  return value;
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0 || value === "" || value == null) return false;
  return value;
}

const customerReturnItemSchema = z.object({
  productId: z.coerce.number().int().positive(),
  productVariantId: z.coerce.number().int().positive(),
  productName: z.string().trim().min(1).max(255),
  variantName: z.string().trim().min(1).max(255).default("Default"),
  quantity: z.coerce.number().int().positive(),
  unitPrice: z.coerce.number().min(0),
  lineTotal: z.coerce.number().min(0),
  restockFlag: z.preprocess(normalizeBoolean, z.boolean()).default(false)
});

export const listCustomerReturnsSchema = z.preprocess((value) => {
  const input = value && typeof value === "object" ? { ...value } : {};
  for (const key of ["search", "status", "reason", "sortField", "sortOrder", "page", "perPage"]) {
    input[key] = nullishToUndefined(input[key]);
  }
  if (input.sortField === "createdAt") input.sortField = "created_at";
  if (input.sortField === "rmaNumber") input.sortField = "rma_number";
  if (input.sortField === "requestDate") input.sortField = "request_date";
  return input;
}, z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
  status: customerReturnStatusSchema.optional(),
  reason: z.string().trim().min(1).max(100).optional(),
  sortField: sortableFieldSchema.default("created_at"),
  sortOrder: sortOrderSchema.default("desc")
}));

export const customerReturnParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const customerReturnCustomerParamsSchema = z.object({
  customerId: z.coerce.number().int().positive()
});

export const createCustomerReturnSchema = z.object({
  rmaNumber: z.string().trim().max(50).optional(),
  customerId: z.coerce.number().int().positive(),
  invoiceId: z.preprocess(normalizeNullableId, z.union([z.coerce.number().int().positive(), z.null()])).optional(),
  requestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1).max(100),
  disposition: z.string().trim().min(1).max(100),
  status: customerReturnStatusSchema.default("draft"),
  totalAmount: z.coerce.number().min(0).default(0),
  notes: z.preprocess(normalizeNullableId, z.union([z.string().trim().max(5000), z.null()])).optional(),
  items: z.array(customerReturnItemSchema).min(1, "At least one return item is required")
});

export const updateCustomerReturnSchema = createCustomerReturnSchema;

export const rejectCustomerReturnSchema = z.object({
  reason: z.string().trim().min(1).max(500)
});
