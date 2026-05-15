import { Router } from "express";
import { authenticate } from "#shared/middleware/auth.middleware";
import { resolveBranch } from "#shared/middleware/branch-context.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import { DashboardController } from "./dashboard.controller.js";
import {
  dashboardOverviewQuerySchema,
  dashboardReceivablesCalendarQuerySchema
} from "./dashboard.validator.js";

const router = Router();
const controller = new DashboardController();

router.get("/overview", authenticate, resolveBranch, validateRequest(dashboardOverviewQuerySchema, "query"), controller.overview);
router.get("/notifications", authenticate, resolveBranch, controller.notifications);
router.get(
  "/receivables-calendar",
  authenticate,
  resolveBranch,
  validateRequest(dashboardReceivablesCalendarQuerySchema, "query"),
  controller.receivablesCalendar
);

export { router as dashboardRoutes };
