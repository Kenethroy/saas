import { Router } from "express";
import { AuthController } from "#modules/auth/auth.controller";
import { loginSchema, registerSchema } from "#modules/auth/auth.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new AuthController();

router.post("/register", validateRequest(registerSchema), controller.register);
router.post("/login", validateRequest(loginSchema), controller.login);
router.post("/logout", authenticate, controller.logout);
router.get("/me", authenticate, controller.currentUser);
router.get("/sessions", authenticate, controller.sessions);
router.post("/logout-others", authenticate, controller.logoutOtherSessions);

export { router as authRoutes };
