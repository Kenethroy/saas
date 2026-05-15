import { Router } from "express";
import { ProductsController } from "#modules/products/products.controller";
import {
  createProductSchema,
  createVariantSchema,
  listInventoryOverviewSchema,
  listProductOptionsSchema,
  listProductsSchema,
  updateProductSchema,
  updateVariantSchema
} from "#modules/products/products.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { resolveBranch } from "#shared/middleware/branch-context.middleware";
import { requireAnyPermission, requirePermission } from "#shared/middleware/permission.middleware";
import { uploadProductImage } from "#shared/middleware/upload.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new ProductsController();

router.get("/inventory-overview", authenticate, resolveBranch, requirePermission("products.view"), validateRequest(listInventoryOverviewSchema, "query"), controller.inventoryOverview);
router.get("/list", authenticate, resolveBranch, requirePermission("products.view"), validateRequest(listProductOptionsSchema, "query"), controller.listForSalesOrder);
router.get("/brochure/pdf", authenticate, resolveBranch, requirePermission("products.view"), controller.brochurePdf);
router.get("/", authenticate, resolveBranch, requirePermission("products.view"), validateRequest(listProductsSchema, "query"), controller.list);
router.get("/:id", authenticate, resolveBranch, requirePermission("products.view"), controller.getById);
router.post("/upload-image", authenticate, resolveBranch, requireAnyPermission(["products.create", "products.update"]), uploadProductImage, controller.uploadImage);
router.delete("/upload-image", authenticate, resolveBranch, requireAnyPermission(["products.create", "products.update"]), controller.deleteUploadedImage);
router.post("/create", authenticate, resolveBranch, requirePermission("products.create"), validateRequest(createProductSchema), controller.create);
router.patch("/:id", authenticate, resolveBranch, requirePermission("products.update"), validateRequest(updateProductSchema), controller.update);
router.delete("/:id", authenticate, resolveBranch, requirePermission("products.delete"), controller.delete);

router.post("/:id/variants/create", authenticate, resolveBranch, requirePermission("products.create"), validateRequest(createVariantSchema), controller.createVariant);
router.patch("/variants/:variantId", authenticate, resolveBranch, requirePermission("products.update"), validateRequest(updateVariantSchema), controller.updateVariant);
router.delete("/variants/:variantId", authenticate, resolveBranch, requirePermission("products.delete"), controller.deleteVariant);

export { router as productsRoutes };
