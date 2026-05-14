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

  for (const key of ["search", "status", "page", "perPage", "hasReceivables"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

function normalizeCustomerBody(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (input.paymentTermId === undefined && input.payment_term_id !== undefined) {
    input.paymentTermId = input.payment_term_id;
  }

  if (input.paymentTermId === "" || input.paymentTermId === "null" || input.paymentTermId === "undefined") {
    input.paymentTermId = null;
  }

  if (input.email === "") {
    input.email = null;
  }

  if (input.phone === "") {
    input.phone = null;
  }

  if (input.company === "") {
    input.company = null;
  }

  if (input.address === "") {
    input.address = null;
  }

  return input;
}

function normalizeCustomerActionBody(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["page", "limit", "status", "search"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  if (input.status !== undefined) {
    const statusMap = {
      0: "pending",
      1: "processing",
      2: "for_delivery",
      3: "delivered",
      4: "completed",
      5: "cancelled",
      pending: "pending",
      processing: "processing",
      for_delivery: "for_delivery",
      delivered: "delivered",
      completed: "completed",
      cancelled: "cancelled"
    };

    const raw = String(input.status).trim().toLowerCase();
    input.status = statusMap[raw] ?? statusMap[Number(raw)] ?? undefined;
  }

  return input;
}

export const listCustomersSchema = z.preprocess(normalizeListQuery, z.object({
  search: z.string().trim().optional(),
  status: booleanish.optional(),
  hasReceivables: booleanish.optional(),
  page: z.coerce.number().int().positive().max(100000).optional(),
  perPage: z.coerce.number().int().positive().max(1000).optional()
}));

const customerShape = {
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(255).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  company: z.string().trim().max(255).nullable().optional(),
  address: z.string().trim().max(2000).nullable().optional(),
  paymentTermId: z.coerce.number().int().positive().nullable().optional(),
  status: booleanish.optional()
};

export const createCustomerSchema = z.preprocess(normalizeCustomerBody, z.object({
  ...customerShape,
  openingBalance: z.coerce.number().min(0).optional(),
  agentId: z.coerce.number().int().positive().nullable().optional()
}));

export const updateCustomerSchema = z.preprocess(
  normalizeCustomerBody,
  z.object(customerShape).partial().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  })
);

export const customerParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const customerOrdersSchema = z.preprocess(normalizeCustomerActionBody, z.object({
  page: z.coerce.number().int().positive().max(100000).default(1),
  limit: z.coerce.number().int().positive().max(1000).default(10),
  status: z.enum(["pending", "processing", "for_delivery", "delivered", "completed", "cancelled"]).optional()
}));

export const customerPaymentsSchema = z.preprocess(normalizeCustomerActionBody, z.object({
  page: z.coerce.number().int().positive().max(100000).default(1),
  limit: z.coerce.number().int().positive().max(1000).default(10)
}));

export const customerReturnsSchema = z.preprocess(normalizeCustomerActionBody, z.object({
  page: z.coerce.number().int().positive().max(100000).default(1),
  limit: z.coerce.number().int().positive().max(1000).default(10),
  status: z.enum(["draft", "pending", "approved", "completed", "rejected"]).optional(),
  search: z.string().trim().min(1).optional()
}));

export const customerStatementQuerySchema = z.preprocess((value) => {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["from", "to"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}, z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}));
