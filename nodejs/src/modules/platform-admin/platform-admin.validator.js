import { z } from "zod";

function normalizeQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  const nullableKeys = ["q", "status", "subscriptionStatus", "tenantStatus", "provider", "planCode", "currentStep", "domainStatus"];
  for (const key of nullableKeys) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

function normalizePatch(value) {
  return value && typeof value === "object" ? { ...value } : {};
}

function nullableTrimmedString(maxLength) {
  return z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === "" || value === "null") {
      return null;
    }

    return typeof value === "string" ? value.trim() : value;
  }, z.string().max(maxLength).nullable().optional());
}

function nullableNumberField() {
  return z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === "") {
      return null;
    }

    if (typeof value === "string") {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      return Number(normalized);
    }

    return value;
  }, z.number().finite().nonnegative().nullable().optional());
}

function integerLimitField() {
  return z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === "") {
      return null;
    }

    if (typeof value === "string") {
      const normalized = value.trim();
      if (!normalized) {
        return null;
      }
      return Number(normalized);
    }

    return value;
  }, z.number().int().nonnegative().nullable().optional());
}

function booleanField() {
  return z.preprocess((value) => {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "on"].includes(normalized)) {
        return true;
      }
      if (["false", "0", "no", "off"].includes(normalized)) {
        return false;
      }
    }

    return value;
  }, z.boolean().optional());
}

function patchSchema(shape) {
  return z.preprocess(normalizePatch, z.object(shape).strict().refine(
    (value) => Object.keys(value).length > 0,
    { message: "At least one field is required" }
  ));
}

export const platformAdminLoginSchema = z.object({
  credential: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(255)
});

export const platformAdminTenantsListQuerySchema = z.preprocess(normalizeQuery, z.object({
  q: z.string().trim().min(2).max(100).optional(),
  status: z.enum(["pending", "active", "inactive", "suspended", "cancelled"]).optional(),
  subscriptionStatus: z.enum(["incomplete", "trialing", "active", "past_due", "expired", "cancelled", "suspended"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
}));

export const platformAdminSubscriptionsListQuerySchema = z.preprocess(normalizeQuery, z.object({
  q: z.string().trim().min(2).max(100).optional(),
  status: z.enum(["incomplete", "trialing", "active", "past_due", "expired", "cancelled", "suspended"]).optional(),
  tenantStatus: z.enum(["pending", "active", "inactive", "suspended", "cancelled"]).optional(),
  provider: z.enum(["manual", "stripe", "paymongo", "xendit", "paddle"]).optional(),
  planCode: z.string().trim().min(2).max(100).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
}));

export const platformAdminOnboardingAuditListQuerySchema = z.preprocess(normalizeQuery, z.object({
  q: z.string().trim().min(2).max(100).optional(),
  currentStep: z.enum(["account", "business_info", "plan", "payment", "activation", "completed"]).optional(),
  tenantStatus: z.enum(["pending", "active", "inactive", "suspended", "cancelled"]).optional(),
  domainStatus: z.enum(["pending", "verified", "active", "failed", "redirected"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20)
}));

export const platformAdminIdParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const platformAdminPlanUpdateSchema = patchSchema({
  name: z.string().trim().min(1).max(120).optional(),
  description: nullableTrimmedString(1000),
  priceMonthly: nullableNumberField(),
  priceYearly: nullableNumberField(),
  maxBranches: integerLimitField(),
  maxUsers: integerLimitField(),
  maxProducts: integerLimitField(),
  maxStorageGb: integerLimitField(),
  allowReports: booleanField(),
  allowBackup: booleanField(),
  allowApiAccess: booleanField(),
  allowMultiBranch: booleanField(),
  isActive: booleanField()
});

export const platformAdminPlanPriceUpdateSchema = patchSchema({
  name: z.string().trim().min(1).max(120).optional(),
  description: nullableTrimmedString(1000),
  checkoutMode: z.enum(["subscription", "payment"]).optional(),
  price: nullableNumberField(),
  providerPriceId: nullableTrimmedString(255),
  isActive: booleanField()
});

export const platformAdminSubscriptionActionSchema = z.object({
  action: z.enum(["suspend", "reactivate"]),
  reason: nullableTrimmedString(1000)
});
