import { Router } from "express";
import { authenticate } from "#shared/middleware/auth.middleware";
import { validateRequest } from "#shared/middleware/validate-request.middleware";
import { AgentPerformanceController } from "./agent-performance.controller.js";
import {
  agentCollectionHistoryQuerySchema,
  agentParamsSchema,
  agentPerformanceQuerySchema,
  agentRemittanceLedgerQuerySchema,
  agentSalesHistoryQuerySchema,
  adminCollectionQueueQuerySchema,
  adminRemittanceReviewQuerySchema
} from "./agent-performance.validator.js";

const router = Router();
const controller = new AgentPerformanceController();

router.get("/sales", authenticate, validateRequest(agentPerformanceQuerySchema, "query"), controller.sales);
router.get("/sales/trend", authenticate, validateRequest(agentPerformanceQuerySchema, "query"), controller.salesTrend);
router.get("/collections", authenticate, validateRequest(agentPerformanceQuerySchema, "query"), controller.collections);
router.get("/collections/trend", authenticate, validateRequest(agentPerformanceQuerySchema, "query"), controller.collectionsTrend);
router.get("/collection-queue", authenticate, validateRequest(adminCollectionQueueQuerySchema, "query"), controller.collectionQueue);
router.get("/remittance-review", authenticate, validateRequest(adminRemittanceReviewQuerySchema, "query"), controller.remittanceReview);
router.get("/agents/:id/profile", authenticate, validateRequest(agentParamsSchema, "params"), controller.profile);
router.get("/agents/:id/sales-history", authenticate, validateRequest(agentParamsSchema, "params"), validateRequest(agentSalesHistoryQuerySchema, "query"), controller.salesHistory);
router.get("/agents/:id/collection-history", authenticate, validateRequest(agentParamsSchema, "params"), validateRequest(agentCollectionHistoryQuerySchema, "query"), controller.collectionHistory);
router.get("/agents/:id/remittance-ledger", authenticate, validateRequest(agentParamsSchema, "params"), validateRequest(agentRemittanceLedgerQuerySchema, "query"), controller.remittanceLedger);

export { router as agentPerformanceRoutes };
