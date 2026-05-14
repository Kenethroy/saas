import { z } from "zod";

function normalizeListQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["search", "status", "page", "limit"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

function normalizeSupplierBody(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (input.paymentTermId === undefined && input.payment_term_id !== undefined) {
    input.paymentTermId = input.payment_term_id;
  }

  if (input.paymentTermId === "" || input.paymentTermId === "null" || input.paymentTermId === "undefined") {
    input.paymentTermId = null;
  }

  if (input.email === "") input.email = null;
  if (input.phone === "") input.phone = null;
  if (input.companyName === "") input.companyName = null;
  if (input.contactPerson === "") input.contactPerson = null;
  if (input.address === "") input.address = null;

  return input;
}

export const listSuppliersSchema = z.preprocess(normalizeListQuery, z.object({
  search: z.string().trim().optional(),
  status: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().max(100000).default(1),
  limit: z.coerce.number().int().positive().max(1000).default(10)
}));

const supplierShape = {
  name: z.string().trim().min(1).max(255),
  companyName: z.string().trim().max(255).nullable().optional(),
  contactPerson: z.string().trim().max(255).nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  address: z.string().trim().max(2000).nullable().optional(),
  paymentTermId: z.coerce.number().int().positive().nullable().optional(),
  status: z.coerce.number().int().optional()
};

export const createSupplierSchema = z.preprocess(normalizeSupplierBody, z.object(supplierShape));

export const updateSupplierSchema = z.preprocess(
  normalizeSupplierBody,
  z.object(supplierShape).partial().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  })
);

export const supplierParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});
