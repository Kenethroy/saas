import { Router } from "express";
import { SubscriptionsController } from "#modules/subscriptions/subscriptions.controller";

const router = Router();
const controller = new SubscriptionsController();

router.get("/plans", controller.listPlans);

export { router as subscriptionsRoutes };
