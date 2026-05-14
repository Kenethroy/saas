import { Router } from "express";
import { CategoriesController } from "#modules/categories/categories.controller";
import {
  createCategorySchema,
  listCategoriesSchema,
  updateCategorySchema
} from "#modules/categories/categories.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new CategoriesController();

router.get("/options", authenticate, requirePermission("categories.view"), controller.listOptions);
router.get("/list", authenticate, requirePermission("categories.view"), controller.listForSelection);
router.get("/", authenticate, requirePermission("categories.view"), validateRequest(listCategoriesSchema, "query"), controller.list);
router.get("/:id", authenticate, requirePermission("categories.view"), controller.getById);
router.post("/create", authenticate, requirePermission("categories.create"), validateRequest(createCategorySchema), controller.create);
router.patch("/:id", authenticate, requirePermission("categories.update"), validateRequest(updateCategorySchema), controller.update);
router.delete("/:id", authenticate, requirePermission("categories.delete"), controller.delete);

export { router as categoriesRoutes };
