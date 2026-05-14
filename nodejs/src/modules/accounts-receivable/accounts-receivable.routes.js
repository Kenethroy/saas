import { Router } from "express";
import { AccountsReceivableController } from "#modules/accounts-receivable/accounts-receivable.controller";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import { authenticate } from "#shared/middleware/auth.middleware";
import { listARSchema, updateARSchema } from "#modules/accounts-receivable/accounts-receivable.validator";

const router = Router();
const controller = new AccountsReceivableController();

router.get("/list", authenticate, validateRequest(listARSchema, "query"), controller.list);
router.get("/:id", authenticate, controller.getById);
router.put("/update/:id", authenticate, validateRequest(updateARSchema), controller.update);

export { router as accountsReceivableRoutes };
