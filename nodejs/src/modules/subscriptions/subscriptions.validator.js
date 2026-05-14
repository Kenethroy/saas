import { z } from "zod";

export const checkoutSubscriptionSchema = z.object({
  planCode: z.enum(["starter", "pro", "enterprise"]),
  billingCycle: z.enum(["monthly", "yearly", "custom"]).default("monthly"),
  provider: z.enum(["manual", "stripe", "paymongo", "xendit", "paddle"]).default("manual"),
  providerSubscriptionId: z.string().trim().min(1).max(255).optional(),
  businessName: z.string().trim().min(1).max(255),
  legalName: z.string().trim().min(1).max(255).optional(),
  businessType: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(3).max(50).optional(),
  businessEmail: z.string().trim().toLowerCase().email().max(255).optional(),
  address: z.string().trim().min(1).max(5000).optional(),
  currencyCode: z.string().trim().min(3).max(10).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
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
