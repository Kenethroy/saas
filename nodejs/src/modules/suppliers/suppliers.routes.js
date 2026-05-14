import { Router } from "express";
import { suppliersController } from "#modules/suppliers/suppliers.controller";
import { 
  listSuppliersSchema,
  createSupplierSchema,
  updateSupplierSchema,
  supplierParamsSchema 
} from "#modules/suppliers/suppliers.validator";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";

const router = Router();

router.get(
  "/", 
  authenticate,
  requirePermission("suppliers.view"),
  validateRequest(listSuppliersSchema, "query"), 
  suppliersController.getSuppliers
);

router.post(
  "/", 
  authenticate,
  requirePermission("suppliers.create"),
  validateRequest(createSupplierSchema, "body"), 
  suppliersController.createSupplier
);

router.get(
  "/:id/details",
  authenticate,
  requirePermission("suppliers.view"),
  validateRequest(supplierParamsSchema, "params"),
  suppliersController.getSupplierDetails
);

router.get(
  "/:id", 
  authenticate,
  requirePermission("suppliers.view"),
  validateRequest(supplierParamsSchema, "params"), 
  suppliersController.getSupplier
);

router.put(
  "/:id", 
  authenticate,
  requirePermission("suppliers.update"),
  validateRequest(supplierParamsSchema, "params"), 
  validateRequest(updateSupplierSchema, "body"), 
  suppliersController.updateSupplier
);

router.patch(
  "/:id/status", 
  authenticate,
  requirePermission("suppliers.update"),
  validateRequest(supplierParamsSchema, "params"), 
  suppliersController.updateSupplierStatus
);

router.delete(
  "/:id", 
  authenticate,
  requirePermission("suppliers.delete"),
  validateRequest(supplierParamsSchema, "params"), 
  suppliersController.deleteSupplier
);

export { router as suppliersRoutes };
