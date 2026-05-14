import { z } from "zod";

const paymentMethodMap = {
  1: "cash",
  2: "cheque",
  3: "bank_transfer",
  4: "credit_card",
  cash: "cash",
  cheque: "cheque",
  check: "cheque",
  "bank transfer": "bank_transfer",
  bank_transfer: "bank_transfer",
  "credit card": "credit_card",
  credit_card: "credit_card",
  other: "other"
};

function normalizeCreateCustomerPaymentBody(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (input.customerId === undefined && input.customer_id !== undefined) {
    input.customerId = input.customer_id;
  }
  if (input.paymentDate === undefined && input.date !== undefined) {
    input.paymentDate = input.date;
  }
  if (input.paymentMethod === undefined && input.payment_method !== undefined) {
    input.paymentMethod = input.payment_method;
  }
  if (input.referenceNumber === undefined && input.reference_number !== undefined) {
    input.referenceNumber = input.reference_number;
  }
  if (input.referenceNumber === "") {
    input.referenceNumber = null;
  }
  if (input.notes === "") {
    input.notes = null;
  }

  if (input.paymentMethod !== undefined && input.paymentMethod !== null && input.paymentMethod !== "") {
    const raw = String(input.paymentMethod).trim().toLowerCase();
    input.paymentMethod = paymentMethodMap[raw] ?? paymentMethodMap[Number(raw)] ?? input.paymentMethod;
  }

  return input;
}

export const createCustomerPaymentSchema = z.preprocess(normalizeCreateCustomerPaymentBody, z.object({
  customerId: z.coerce.number().int().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["cash", "cheque", "bank_transfer", "credit_card", "other"]),
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional()
}));

function normalizeCreateSupplierPaymentBody(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (input.supplierId === undefined && input.supplier_id !== undefined) {
    input.supplierId = input.supplier_id;
  }
  if (input.accountsPayableId === undefined && input.accounts_payable_id !== undefined) {
    input.accountsPayableId = input.accounts_payable_id;
  }
  if (input.accountsPayableId === undefined && input.invoiceId !== undefined) {
    input.accountsPayableId = input.invoiceId;
  }
  if (input.accountsPayableId === undefined && input.invoice_id !== undefined) {
    input.accountsPayableId = input.invoice_id;
  }
  if (input.paymentDate === undefined && input.date !== undefined) {
    input.paymentDate = input.date;
  }
  if (input.paymentMethod === undefined && input.payment_method !== undefined) {
    input.paymentMethod = input.payment_method;
  }
  if (input.referenceNumber === undefined && input.reference_number !== undefined) {
    input.referenceNumber = input.reference_number;
  }
  if (input.referenceNumber === "") {
    input.referenceNumber = null;
  }
  if (input.notes === "") {
    input.notes = null;
  }

  if (input.paymentMethod !== undefined && input.paymentMethod !== null && input.paymentMethod !== "") {
    const raw = String(input.paymentMethod).trim().toLowerCase();
    input.paymentMethod = paymentMethodMap[raw] ?? paymentMethodMap[Number(raw)] ?? input.paymentMethod;
  }

  return input;
}

export const createSupplierPaymentSchema = z.preprocess(normalizeCreateSupplierPaymentBody, z.object({
  supplierId: z.coerce.number().int().positive(),
  accountsPayableId: z.coerce.number().int().positive(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(["cash", "cheque", "bank_transfer", "credit_card", "other"]),
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional()
}));

function normalizePaymentListQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["page", "limit", "search", "customerId"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

export const listPaymentsSchema = z.preprocess(normalizePaymentListQuery, z.object({
  page: z.coerce.number().int().positive().max(100000).default(1),
  limit: z.coerce.number().int().positive().max(1000).default(10),
  search: z.string().trim().optional(),
  customerId: z.coerce.number().int().positive().optional()
}));
