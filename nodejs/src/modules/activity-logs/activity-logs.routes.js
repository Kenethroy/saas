import { Router } from "express";
import { ActivityLogsController } from "#modules/activity-logs/activity-logs.controller";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";

const router = Router();
const controller = new ActivityLogsController();

router.get("/", authenticate, requirePermission("activity_logs.view"), controller.getLogs);

export { router as activityLogsRoutes };
