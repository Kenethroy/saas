import { Router } from "express";
import { TrucksController } from "#modules/trucks/trucks.controller";
import {
  createTruckSchema,
  listTruckOptionsSchema,
  listTrucksSchema,
  updateTruckSchema
} from "#modules/trucks/trucks.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { resolveBranch } from "#shared/middleware/branch-context.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new TrucksController();

router.get("/list", authenticate, resolveBranch, requirePermission("trucks.view"), validateRequest(listTruckOptionsSchema, "query"), controller.listForAssignment);
router.get("/", authenticate, resolveBranch, requirePermission("trucks.view"), validateRequest(listTrucksSchema, "query"), controller.list);
router.get("/:id", authenticate, resolveBranch, requirePermission("trucks.view"), controller.getById);
router.post("/create", authenticate, resolveBranch, requirePermission("trucks.create"), validateRequest(createTruckSchema), controller.create);
router.patch("/:id", authenticate, resolveBranch, requirePermission("trucks.update"), validateRequest(updateTruckSchema), controller.update);
router.delete("/:id", authenticate, resolveBranch, requirePermission("trucks.delete"), controller.delete);

export { router as trucksRoutes };
