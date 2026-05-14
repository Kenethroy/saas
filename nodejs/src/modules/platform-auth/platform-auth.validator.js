import { z } from "zod";

const normalizedEmail = z.string().trim().toLowerCase().email().max(255);

export const platformRegisterSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(8).max(255),
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional()
});

export const platformLoginSchema = z.object({
  credential: normalizedEmail,
  password: z.string().min(1).max(255)
});
