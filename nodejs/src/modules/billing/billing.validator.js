import { z } from "zod";

export const checkoutBillingSchema = z.object({
  planPriceCode: z.string().trim().min(3).max(100),
  provider: z.enum(["stripe", "xendit"]).default("stripe"),
  businessName: z.string().trim().min(1).max(255),
  legalName: z.string().trim().min(1).max(255).optional(),
  businessType: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(3).max(50).optional(),
  businessEmail: z.string().trim().toLowerCase().email().max(255).optional(),
  address: z.string().trim().min(1).max(500).optional(),
  currencyCode: z.string().trim().min(3).max(10).default("PHP"),
  timezone: z.string().trim().min(1).max(100).default("Asia/Manila"),
  preferredSubdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  ownerUsername: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/),
  primaryBranchName: z.string().trim().min(1).max(150).optional()
});

export const xenditWebhookSchema = z.object({
  event: z.string().trim().min(1),
  created: z.string().trim().optional(),
  business_id: z.string().trim().optional(),
  data: z.object({
    payment_session_id: z.string().trim().min(1),
    reference_id: z.string().trim().min(1),
    status: z.string().trim().optional(),
    amount: z.coerce.number().nonnegative().optional(),
    currency: z.string().trim().optional(),
    customer_id: z.string().trim().optional(),
    payment_id: z.string().trim().optional(),
    payment_request_id: z.string().trim().optional(),
    payment_link_url: z.string().trim().optional(),
    updated: z.string().trim().optional()
  }).passthrough()
}).passthrough();

export const stripeWebhookSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
  data: z.object({
    object: z.object({
      id: z.string().trim().min(1),
      client_reference_id: z.string().trim().min(1).optional(),
      customer: z.string().trim().optional().nullable(),
      subscription: z.string().trim().optional().nullable(),
      payment_status: z.string().trim().optional(),
      status: z.string().trim().optional(),
      currency: z.string().trim().optional(),
      amount_total: z.coerce.number().nonnegative().optional(),
      metadata: z.record(z.string()).optional()
    }).passthrough()
  }).passthrough()
}).passthrough();
