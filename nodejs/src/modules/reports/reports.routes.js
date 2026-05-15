import { Router } from "express";
import { authenticate } from "#shared/middleware/auth.middleware";
import { resolveBranch } from "#shared/middleware/branch-context.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import { reportsController } from "#modules/reports/reports.controller";
import { comparativeReportSchema, inventoryVelocitySchema } from "#modules/reports/reports.validator";

const router = Router();

router.get("/sales-summary", authenticate, resolveBranch, validateRequest(comparativeReportSchema, "query"), reportsController.salesSummary);
router.get("/purchase-summary", authenticate, resolveBranch, validateRequest(comparativeReportSchema, "query"), reportsController.purchaseSummary);
router.get("/profit-loss", authenticate, resolveBranch, validateRequest(comparativeReportSchema, "query"), reportsController.profitLoss);
router.get("/inventory-velocity", authenticate, resolveBranch, validateRequest(inventoryVelocitySchema, "query"), reportsController.inventoryVelocity);

export { router as reportsRoutes };
