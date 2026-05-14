import { describe, expect, it } from "vitest";
import { platformAdminTenantsListQuerySchema } from "#modules/platform-admin/platform-admin.validator";

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

