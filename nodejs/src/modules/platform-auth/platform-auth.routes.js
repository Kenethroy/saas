import { Router } from "express";
import { PlatformAuthController } from "#modules/platform-auth/platform-auth.controller";
import { platformLoginSchema } from "#modules/platform-auth/platform-auth.validator";
import { authenticatePlatformAccount } from "#shared/middleware/platform-auth.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new PlatformAuthController();

router.post("/login", validateRequest(platformLoginSchema), controller.login);
router.get("/me", authenticatePlatformAccount, controller.currentAccount);

export { router as platformAuthRoutes };
