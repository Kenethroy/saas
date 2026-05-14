import { z } from "zod";

const userRole = z.enum(["admin", "staff", "agent", "driver"]);

const booleanish = z.preprocess((value) => {
  if (value === "true" || value === "1" || value === 1) {
    return true;
  }

  if (value === "false" || value === "0" || value === 0) {
    return false;
  }

  return value;
}, z.boolean());

function normalizeListQuery(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["search", "role", "status", "page", "perPage"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

export const listUsersSchema = z.preprocess(normalizeListQuery, z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
  role: userRole.optional(),
  status: booleanish.optional()
}));

export const listUserEmployeeOptionsSchema = z.preprocess(normalizeListQuery, z.object({
  search: z.string().trim().min(1).optional()
}));

export const createUserSchema = z.object({
  employeeId: z.coerce.number().int().positive(),
  username: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(255),
  role: userRole.default("staff"),
  status: z.coerce.boolean().default(true)
});

export const updateUserSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .regex(/^[A-Za-z0-9_.-]+$/)
      .optional(),
    email: z.string().trim().email().max(255).optional(),
    password: z.string().min(6).max(255).optional(),
    role: userRole.optional(),
    status: z.coerce.boolean().optional()
  })
  .refine((value) => Object.keys(value).length > 0, "No fields provided for update");
