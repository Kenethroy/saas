import { Router } from "express";
import { authenticate } from "#shared/middleware/auth.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import { reportsController } from "#modules/reports/reports.controller";
import { comparativeReportSchema, inventoryVelocitySchema } from "#modules/reports/reports.validator";

const router = Router();

router.get("/sales-summary", authenticate, validateRequest(comparativeReportSchema, "query"), reportsController.salesSummary);
router.get("/purchase-summary", authenticate, validateRequest(comparativeReportSchema, "query"), reportsController.purchaseSummary);
router.get("/profit-loss", authenticate, validateRequest(comparativeReportSchema, "query"), reportsController.profitLoss);
router.get("/inventory-velocity", authenticate, validateRequest(inventoryVelocitySchema, "query"), reportsController.inventoryVelocity);

export { router as reportsRoutes };
