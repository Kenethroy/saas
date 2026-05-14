import { z } from "zod";

const currentYear = new Date().getFullYear();

function normalizeQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (input.compare_with !== undefined && input.compareWith === undefined) {
    input.compareWith = input.compare_with;
  }

  if (input.search === "" || input.search === null || input.search === "null" || input.search === "undefined") {
    input.search = undefined;
  }

  return input;
}

export const agentPerformanceQuerySchema = z.preprocess(normalizeQuery, z.object({
  period: z.enum(["month", "quarter", "year"]).default("month"),
  year: z.coerce.number().int().min(2020).max(currentYear + 5).default(currentYear),
  month: z.coerce.number().int().min(1).max(12).optional(),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  search: z.string().trim().min(1).optional(),
  compareWith: z.enum(["previous", "year_ago", "none"]).default("previous")
}).superRefine((value, ctx) => {
  if (value.period === "month" && value.month !== undefined && (value.month < 1 || value.month > 12)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["month"],
      message: "month must be between 1 and 12"
    });
  }

  if (value.period === "quarter" && value.quarter !== undefined && (value.quarter < 1 || value.quarter > 4)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["quarter"],
      message: "quarter must be between 1 and 4"
    });
  }
}));

export const agentParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const agentSalesHistoryQuerySchema = z.preprocess(normalizeQuery, z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
  status: z.enum(["pending", "processing", "for_delivery", "delivered", "completed", "cancelled"]).optional()
}));

export const agentCollectionHistoryQuerySchema = z.preprocess(normalizeQuery, z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional()
}));

export const agentRemittanceLedgerQuerySchema = z.preprocess(normalizeQuery, z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional()
}));

export const adminCollectionQueueQuerySchema = z.preprocess(normalizeQuery, z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
  bucket: z.enum(["all", "current", "1_30", "31_60", "61_90", "over_90"]).default("all"),
  agentId: z.coerce.number().int().positive().optional()
}));

export const adminRemittanceReviewQuerySchema = z.preprocess(normalizeQuery, z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional()
}));
