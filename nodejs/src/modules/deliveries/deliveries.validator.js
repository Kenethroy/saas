import { z } from "zod";

const deliveryStatusSchema = z.enum(["pending", "in_transit", "delivered", "cancelled"]);
const completionDetailSchema = z.object({
  salesOrderId: z.coerce.number().int().positive(),
  recipientName: z.string().trim().min(1).max(255),
  deliveryNotes: z.string().trim().max(1000).optional().nullable()
});

const nullishString = (value) => {
  if (value === "" || value === null || value === "null" || value === "undefined") {
    return undefined;
  }
  return value;
};

export const deliveryParamsSchema = z.object({
  id: z.coerce.number().int().positive()
});

export const listDeliveriesSchema = z.preprocess((value) => {
  const input = value && typeof value === "object" ? { ...value } : {};

  for (const key of ["search", "status", "salesOrderId", "dateFrom", "dateTo", "page", "perPage"]) {
    input[key] = nullishString(input[key]);
  }

  return input;
}, z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().min(1).optional(),
  status: deliveryStatusSchema.optional(),
  salesOrderId: z.coerce.number().int().positive().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
}));

export const createDeliverySchema = z.object({
  salesOrderIds: z.array(z.coerce.number().int().positive()).min(1, "At least one sales order is required"),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  driverId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  truckId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  notes: z.string().trim().max(5000).nullable().optional()
});

export const updateDeliverySchema = z.object({
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  driverId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  truckId: z.union([z.coerce.number().int().positive(), z.null()]).optional(),
  notes: z.string().trim().max(5000).nullable().optional()
}).refine((value) => Object.keys(value).length > 0, {
  message: "At least one field is required"
});

export const updateDeliveryStatusSchema = z.object({
  status: deliveryStatusSchema,
  recipientName: z.string().trim().max(255).optional().nullable(),
  deliveryNotes: z.string().trim().max(1000).optional().nullable(),
  completionDetails: z.array(completionDetailSchema).optional()
});
