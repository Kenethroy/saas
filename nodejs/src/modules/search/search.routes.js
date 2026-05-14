import { Router } from "express";
import { SearchController } from "#modules/search/search.controller";
import { globalSearchQuerySchema } from "#modules/search/search.validator";
import { authenticate } from "#shared/middleware/auth.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";

const router = Router();
const controller = new SearchController();

router.get("/global", authenticate, validateRequest(globalSearchQuerySchema, "query"), controller.global);

export { router as searchRoutes };
