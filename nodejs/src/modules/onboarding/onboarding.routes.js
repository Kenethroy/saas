import { Router } from "express";
import { OnboardingController } from "#modules/onboarding/onboarding.controller";
import { onboardingStartSchema } from "#modules/onboarding/onboarding.validator";
import { authenticatePlatformAccount } from "#shared/middleware/platform-auth.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new OnboardingController();

router.post("/start", authenticatePlatformAccount, validateRequest(onboardingStartSchema), controller.start);
router.get("/:id/status", authenticatePlatformAccount, controller.status);

export { router as onboardingRoutes };
