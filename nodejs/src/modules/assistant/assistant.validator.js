import { z } from "zod";

function normalizeAssistantPayload(value) {
  const input = value && typeof value === "object" ? { ...value } : {};
  const context = input.context && typeof input.context === "object" ? { ...input.context } : undefined;

  if (input.question === "" || input.question === null || input.question === "null" || input.question === "undefined") {
    input.question = undefined;
  }

  if (context) {
    if (context.customerId === "" || context.customerId === null || context.customerId === "null" || context.customerId === "undefined") {
      context.customerId = undefined;
    }

    if (context.module === "" || context.module === null || context.module === "null" || context.module === "undefined") {
      context.module = undefined;
    }

    input.context = context;
  }

  return input;
}

export const assistantQuerySchema = z.preprocess(normalizeAssistantPayload, z.object({
  question: z.string().trim().min(2).max(500),
  context: z.object({
    customerId: z.coerce.number().int().positive().optional(),
    module: z.string().trim().max(100).optional()
  }).optional()
}));

function normalizeAssistantReindexPayload(value) {
  const input = value && typeof value === "object" ? { ...value } : {};

  if (input.scope === "" || input.scope === null || input.scope === "null" || input.scope === "undefined") {
    input.scope = undefined;
  }

  if (input.limit === "" || input.limit === null || input.limit === "null" || input.limit === "undefined") {
    input.limit = undefined;
  }

  return input;
}

export const assistantReindexSchema = z.preprocess(normalizeAssistantReindexPayload, z.object({
  scope: z.array(z.enum(["customers", "products", "suppliers"])).min(1).default(["customers", "products", "suppliers"]),
  limit: z.coerce.number().int().positive().max(500).optional()
}));
