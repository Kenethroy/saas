import { describe, expect, it } from "vitest";
import {
  platformAdminPlanPriceUpdateSchema,
  platformAdminPlanUpdateSchema,
  platformAdminSubscriptionActionSchema,
  platformAdminOnboardingAuditListQuerySchema,
  platformAdminSubscriptionsListQuerySchema,
  platformAdminTenantsListQuerySchema
} from "#modules/platform-admin/platform-admin.validator";

describe("platformAdminTenantsListQuerySchema", () => {
  it("defaults paging values", () => {
    const parsed = platformAdminTenantsListQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.perPage).toBe(20);
  });

  it("normalizes empty string filters to undefined", () => {
    const parsed = platformAdminTenantsListQuerySchema.parse({
      q: "",
      status: "",
      subscriptionStatus: ""
    });

    expect(parsed.q).toBeUndefined();
    expect(parsed.status).toBeUndefined();
    expect(parsed.subscriptionStatus).toBeUndefined();
  });
});

describe("platformAdminPlanUpdateSchema", () => {
  it("normalizes nullable values", () => {
    const parsed = platformAdminPlanUpdateSchema.parse({
      description: "",
      priceMonthly: "",
      maxBranches: "",
      allowReports: "true"
    });

    expect(parsed.description).toBeNull();
    expect(parsed.priceMonthly).toBeNull();
    expect(parsed.maxBranches).toBeNull();
    expect(parsed.allowReports).toBe(true);
  });
});

describe("platformAdminSubscriptionsListQuerySchema", () => {
  it("defaults paging values and normalizes blank filters", () => {
    const parsed = platformAdminSubscriptionsListQuerySchema.parse({
      q: "",
      status: "",
      provider: "",
      planCode: "",
      tenantStatus: ""
    });

    expect(parsed.q).toBeUndefined();
    expect(parsed.status).toBeUndefined();
    expect(parsed.provider).toBeUndefined();
    expect(parsed.planCode).toBeUndefined();
    expect(parsed.tenantStatus).toBeUndefined();
    expect(parsed.page).toBe(1);
    expect(parsed.perPage).toBe(20);
  });
});

describe("platformAdminOnboardingAuditListQuerySchema", () => {
  it("defaults paging values and normalizes blank filters", () => {
    const parsed = platformAdminOnboardingAuditListQuerySchema.parse({
      q: "",
      currentStep: "",
      tenantStatus: "",
      domainStatus: ""
    });

    expect(parsed.q).toBeUndefined();
    expect(parsed.currentStep).toBeUndefined();
    expect(parsed.tenantStatus).toBeUndefined();
    expect(parsed.domainStatus).toBeUndefined();
    expect(parsed.page).toBe(1);
    expect(parsed.perPage).toBe(20);
  });
});

describe("platformAdminPlanPriceUpdateSchema", () => {
  it("normalizes provider and price fields", () => {
    const parsed = platformAdminPlanPriceUpdateSchema.parse({
      providerPriceId: "",
      price: "2999.5",
      isActive: "false"
    });

    expect(parsed.providerPriceId).toBeNull();
    expect(parsed.price).toBe(2999.5);
    expect(parsed.isActive).toBe(false);
  });
});

describe("platformAdminSubscriptionActionSchema", () => {
  it("normalizes blank reason to null", () => {
    const parsed = platformAdminSubscriptionActionSchema.parse({
      action: "suspend",
      reason: ""
    });

    expect(parsed.reason).toBeNull();
  });
});
