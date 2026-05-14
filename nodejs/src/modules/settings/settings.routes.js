import { Router } from "express";
import { SettingsController } from "#modules/settings/settings.controller";
import { authenticate } from "#shared/middleware/auth.middleware";
import { requirePermission } from "#shared/middleware/permission.middleware";
import { uploadSystemLogo } from "#shared/middleware/upload.middleware";

const router = Router();
const controller = new SettingsController();

// Public route for brand logo/name on login/public pages
router.get("/public", controller.getPublicSettings);

// Protected routes
router.get("/", authenticate, requirePermission("settings.view"), controller.getSettings);
router.post("/", authenticate, requirePermission("settings.update"), controller.saveSettings);
router.post("/logo", authenticate, requirePermission("settings.update"), uploadSystemLogo, controller.uploadLogo);

router.post("/change-password", authenticate, controller.changePassword);

export { router as settingsRoutes };
