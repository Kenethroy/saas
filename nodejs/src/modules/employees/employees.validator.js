import { z } from "zod";

const employeeStatus = z.enum(["active", "inactive", "on_leave"]);
const rateType = z.enum(["Monthly", "Daily", "Per Trip"]);

const emptyStringToNull = (value) => {
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  return value;
};

const nullableString = z.preprocess(
  emptyStringToNull,
  z.string().trim().max(255).nullable().optional()
);

const nullableDateString = z.preprocess(
  emptyStringToNull,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
);

const nullableMoney = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : Number(value)),
  z.number().min(0).optional()
);

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

  for (const key of ["search", "position", "status", "page", "perPage", "excludeUsers"]) {
    if (input[key] === "" || input[key] === null || input[key] === "null" || input[key] === "undefined") {
      input[key] = undefined;
    }
  }

  return input;
}

export const listEmployeesSchema = z.preprocess(normalizeListQuery, z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
  position: z.string().trim().min(1).optional(),
  status: employeeStatus.optional(),
  excludeUsers: booleanish.optional()
}));

export const createEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  position: z.string().trim().min(1).max(50),
  phone: nullableString,
  email: z.preprocess(emptyStringToNull, z.string().email().max(100).nullable().optional()),
  status: employeeStatus.default("active"),
  address: z.preprocess(emptyStringToNull, z.string().trim().nullable().optional()),
  licenseNumber: nullableString,
  licenseExpiry: nullableDateString,
  emergencyContactName: nullableString,
  emergencyContactPhone: nullableString,
  dateHired: nullableDateString,
  salaryRate: nullableMoney,
  rateType: rateType.default("Daily"),
  sssNo: nullableString,
  tinNo: nullableString,
  philhealthNo: nullableString,
  pagibigNo: nullableString
});

export const updateEmployeeSchema = createEmployeeSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "No fields provided for update"
);
