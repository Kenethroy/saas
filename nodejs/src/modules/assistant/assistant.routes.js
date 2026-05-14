import { Router } from "express";
import { AssistantController } from "#modules/assistant/assistant.controller";
import { assistantQuerySchema, assistantReindexSchema } from "#modules/assistant/assistant.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new AssistantController();

router.get("/status", authenticate, requirePermission("settings.view"), controller.status);
router.post("/query", authenticate, requirePermission("customers.view"), validateRequest(assistantQuerySchema), controller.query);
router.post("/reindex", authenticate, requirePermission("settings.view"), validateRequest(assistantReindexSchema), controller.reindex);

export { router as assistantRoutes };
