import { Router } from "express";
import { PlatformAuthController } from "#modules/platform-auth/platform-auth.controller";
import { platformRegisterSchema } from "#modules/platform-auth/platform-auth.validator";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new PlatformAuthController();

router.post("/register", validateRequest(platformRegisterSchema), controller.register);

export { router as platformAccountsRoutes };
