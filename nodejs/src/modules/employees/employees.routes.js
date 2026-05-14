import { Router } from "express";
import { EmployeesController } from "#modules/employees/employees.controller";
import {
  createEmployeeSchema,
  listEmployeesSchema,
  updateEmployeeSchema
} from "#modules/employees/employees.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new EmployeesController();

router.get("/", authenticate, requirePermission("employees.view"), validateRequest(listEmployeesSchema, "query"), controller.list);
router.get("/:id", authenticate, requirePermission("employees.view"), controller.show);
router.post("/create", authenticate, requirePermission("employees.create"), validateRequest(createEmployeeSchema), controller.create);
router.patch("/:id", authenticate, requirePermission("employees.update"), validateRequest(updateEmployeeSchema), controller.update);
router.delete("/:id", authenticate, requirePermission("employees.delete"), controller.delete);

export { router as employeesRoutes };
