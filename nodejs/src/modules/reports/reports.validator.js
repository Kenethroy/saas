import { z } from "zod";

const periodSchema = z.enum(["month", "quarter", "year", "custom"]);
const compareWithSchema = z.enum(["none", "previous", "year_ago"]);

function normalizePeriodBody(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (input.compare_with !== undefined && input.compareWith === undefined) {
    input.compareWith = input.compare_with;
  }

  if (input.start_date !== undefined && input.startDate === undefined) {
    input.startDate = input.start_date;
  }

  if (input.end_date !== undefined && input.endDate === undefined) {
    input.endDate = input.end_date;
  }

  for (const key of ["startDate", "endDate", "search", "velocity"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  if (input.velocity === "All") {
    input.velocity = undefined;
  }

  return input;
}

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const comparativeReportSchema = z.preprocess(normalizePeriodBody, z.object({
  period: periodSchema.default("month"),
  compareWith: compareWithSchema.default("previous"),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional()
}).superRefine((value, ctx) => {
  if (value.period === "custom" && value.startDate && value.endDate && value.startDate > value.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endDate"],
      message: "endDate must not be earlier than startDate"
    });
  }
}));

export const inventoryVelocitySchema = z.preprocess(normalizePeriodBody, z.object({
  days: z.coerce.number().int().min(1).max(3650).default(30),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().trim().min(1).optional(),
  velocity: z.string().trim().min(1).optional()
}));
