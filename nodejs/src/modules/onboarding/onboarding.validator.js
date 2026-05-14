import { z } from "zod";

export const onboardingStartSchema = z.object({
  preferredSubdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  businessName: z.string().trim().min(1).max(255).optional(),
  legalName: z.string().trim().min(1).max(255).optional(),
  businessType: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(3).max(50).optional(),
  businessEmail: z.string().trim().toLowerCase().email().max(255).optional(),
  address: z.string().trim().min(1).max(5000).optional(),
  currencyCode: z.string().trim().min(3).max(10).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  ownerUsername: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/)
    .optional(),
  primaryBranchName: z.string().trim().min(1).max(150).optional()
});
