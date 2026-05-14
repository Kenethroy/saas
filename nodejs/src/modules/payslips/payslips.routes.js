import { Router } from "express";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import { PayslipsController } from "#modules/payslips/payslips.controller";
import { createPayslipSchema, listPayslipsSchema, updatePayslipSchema } from "#modules/payslips/payslips.validator";

const router = Router();
const controller = new PayslipsController();

router.get("/", authenticate, requirePermission("payslips.view"), validateRequest(listPayslipsSchema, "query"), controller.list);
router.get("/:id", authenticate, requirePermission("payslips.view"), controller.show);
router.get("/:id/pdf", authenticate, requirePermission("payslips.view"), controller.pdf);
router.post("/create", authenticate, requirePermission("payslips.create"), validateRequest(createPayslipSchema), controller.create);
router.patch("/:id", authenticate, requirePermission("payslips.update"), validateRequest(updatePayslipSchema), controller.update);
router.delete("/:id", authenticate, requirePermission("payslips.delete"), controller.delete);

export { router as payslipsRoutes };

