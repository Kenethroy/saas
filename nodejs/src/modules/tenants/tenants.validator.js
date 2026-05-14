import { z } from "zod";

export const tenantRenewSchema = z.object({
  planPriceCode: z.string().trim().min(3).max(100).optional(),
  provider: z.enum(["stripe", "xendit"]).default("stripe")
});
