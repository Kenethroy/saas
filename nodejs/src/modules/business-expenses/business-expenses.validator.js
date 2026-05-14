import { z } from "zod";

const expenseStatusSchema = z.enum(["draft", "pending", "paid", "void"]);
const paymentMethodSchema = z.preprocess((value) => {
  if (value === "check") {
    return "cheque";
  }
  return value;
}, z.enum(["cash", "cheque", "bank_transfer", "credit_card", "other"]));
const recurringFrequencySchema = z.enum(["daily", "weekly", "monthly", "annually"]);
const booleanSchema = z.preprocess((value) => {
  if (value === true || value === false) return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return value;
}, z.boolean());

function normalizeQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (input.limit !== undefined && input.perPage === undefined) {
    input.perPage = input.limit;
  }

  for (const key of ["search", "status", "categoryId", "paymentMethod", "dateFrom", "dateTo", "page", "perPage", "frequency", "isActive"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

function normalizeBody(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (input.paymentMethod === "check") {
    input.paymentMethod = "cheque";
  }

  for (const key of ["description", "payee", "referenceNumber", "attachmentUrl"]) {
    if (input[key] === "") {
      input[key] = null;
    }
  }

  for (const key of ["dayOfMonth", "dayOfWeek", "monthOfYear"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

const manualExpenseShape = {
  categoryId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().max(5000).nullable().optional(),
  payee: z.string().trim().max(255).nullable().optional(),
  paymentMethod: paymentMethodSchema.default("cash"),
  referenceNumber: z.string().trim().max(100).nullable().optional(),
  attachmentUrl: z.string().trim().max(255).nullable().optional(),
  status: expenseStatusSchema.default("paid")
};

export const listBusinessExpensesSchema = z.preprocess(normalizeQuery, z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(15),
  search: z.string().trim().min(1).optional(),
  status: expenseStatusSchema.optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}).transform((value) => ({
  page: value.page,
  limit: value.perPage,
  search: value.search,
  status: value.status,
  categoryId: value.categoryId,
  paymentMethod: value.paymentMethod,
  dateFrom: value.dateFrom,
  dateTo: value.dateTo
})));

export const createBusinessExpenseSchema = z.preprocess(normalizeBody, z.object(manualExpenseShape));

export const updateBusinessExpenseSchema = z.preprocess(
  normalizeBody,
  z.object({
    ...manualExpenseShape,
    categoryId: manualExpenseShape.categoryId.optional(),
    amount: manualExpenseShape.amount.optional(),
    expenseDate: manualExpenseShape.expenseDate.optional(),
    paymentMethod: paymentMethodSchema.optional(),
    status: expenseStatusSchema.optional()
  }).refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  })
);

const recurringExpenseObjectSchema = z.object({
  categoryId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  description: z.string().trim().max(5000).nullable().optional(),
  payee: z.string().trim().max(255).nullable().optional(),
  paymentMethod: paymentMethodSchema.default("cash"),
  frequency: recurringFrequencySchema,
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  monthOfYear: z.coerce.number().int().min(1).max(12).optional(),
  isActive: booleanSchema.default(true)
});

const recurringExpenseBaseSchema = recurringExpenseObjectSchema.superRefine((value, ctx) => {
  if (value.frequency === "monthly" && value.dayOfMonth === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dayOfMonth"],
      message: "dayOfMonth is required for monthly recurring expenses"
    });
  }

  if (value.frequency === "weekly" && value.dayOfWeek === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dayOfWeek"],
      message: "dayOfWeek is required for weekly recurring expenses"
    });
  }

  if (value.frequency === "annually") {
    if (value.monthOfYear === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthOfYear"],
        message: "monthOfYear is required for annual recurring expenses"
      });
    }

    if (value.dayOfMonth === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dayOfMonth"],
        message: "dayOfMonth is required for annual recurring expenses"
      });
    }
  }
});

export const listRecurringBusinessExpensesSchema = z.preprocess(normalizeQuery, z.object({
  search: z.string().trim().min(1).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  frequency: recurringFrequencySchema.optional(),
  isActive: booleanSchema.optional()
}));

export const createRecurringBusinessExpenseSchema = z.preprocess(normalizeBody, recurringExpenseBaseSchema);

export const updateRecurringBusinessExpenseSchema = z.preprocess(
  normalizeBody,
  recurringExpenseObjectSchema.partial().refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  }).superRefine((value, ctx) => {
    if (value.frequency === "monthly" && value.dayOfMonth === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dayOfMonth"],
        message: "dayOfMonth is required when changing frequency to monthly"
      });
    }

    if (value.frequency === "weekly" && value.dayOfWeek === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dayOfWeek"],
        message: "dayOfWeek is required when changing frequency to weekly"
      });
    }

    if (value.frequency === "annually") {
      if (value.monthOfYear === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["monthOfYear"],
          message: "monthOfYear is required when changing frequency to annually"
        });
      }

      if (value.dayOfMonth === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dayOfMonth"],
          message: "dayOfMonth is required when changing frequency to annually"
        });
      }
    }
  })
);

export const businessExpenseParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});
