import { z } from "zod";

const roleSchema = z.enum(["admin", "staff", "agent", "driver"]);

export const syncPermissionsSchema = z.object({
  permissionIds: z.array(z.coerce.number().int().positive()).default([])
});

export const roleParamsSchema = z.object({
  role: roleSchema
});

export { roleSchema };
