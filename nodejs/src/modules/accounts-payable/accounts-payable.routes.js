import { Router } from "express";
import { AccountsPayableController } from "#modules/accounts-payable/accounts-payable.controller";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import {
  listAccountsPayableSchema,
  apParamsSchema,
  updateAccountsPayableSchema
} from "#modules/accounts-payable/accounts-payable.validator";

const router = Router();
const controller = new AccountsPayableController();

router.get(
  "/",
  authenticate,
  requirePermission("accountsPayable.view"),
  validateRequest(listAccountsPayableSchema, "query"),
  controller.list
);

router.get(
  "/:id",
  authenticate,
  requirePermission("accountsPayable.view"),
  validateRequest(apParamsSchema, "params"),
  controller.getById
);

router.patch(
  "/:id",
  authenticate,
  requirePermission("accountsPayable.update"),
  validateRequest(apParamsSchema, "params"),
  validateRequest(updateAccountsPayableSchema, "body"),
  controller.update
);

export { router as accountsPayableRoutes };
