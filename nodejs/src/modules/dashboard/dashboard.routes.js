import { Router } from "express";
import { authenticate } from "#shared/middleware/auth.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import { DashboardController } from "./dashboard.controller.js";
import {
  dashboardOverviewQuerySchema,
  dashboardReceivablesCalendarQuerySchema
} from "./dashboard.validator.js";

const router = Router();
const controller = new DashboardController();

router.get("/overview", authenticate, validateRequest(dashboardOverviewQuerySchema, "query"), controller.overview);
router.get("/notifications", authenticate, controller.notifications);
router.get(
  "/receivables-calendar",
  authenticate,
  validateRequest(dashboardReceivablesCalendarQuerySchema, "query"),
  controller.receivablesCalendar
);

export { router as dashboardRoutes };
