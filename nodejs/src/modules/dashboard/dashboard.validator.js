import { z } from "zod";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

function normalizeQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["year", "month"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

export const dashboardOverviewQuerySchema = z.preprocess(normalizeQuery, z.object({
  year: z.coerce.number().int().min(2020).max(currentYear + 5).default(currentYear),
  month: z.coerce.number().int().min(1).max(12).default(currentMonth)
}));

export const dashboardReceivablesCalendarQuerySchema = dashboardOverviewQuerySchema;
