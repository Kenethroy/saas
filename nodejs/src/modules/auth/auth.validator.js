import { z } from "zod";

export const loginSchema = z.object({
  credential: z.string().trim().min(1),
  password: z.string().min(6)
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  username: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[A-Za-z0-9_.-]+$/),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(255)
});
