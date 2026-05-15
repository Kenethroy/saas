import { AgentPerformanceService } from "#modules/agent-performance/agent-performance.service";

export class AgentPerformanceController {
  constructor(service = new AgentPerformanceService()) {
    this.service = service;
  }

  sales = async (req, res, next) => {
    try {
      const data = await this.service.getSales(req.auth?.user?.tenantId, req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  salesTrend = async (req, res, next) => {
    try {
      const data = await this.service.getSalesTrend(req.auth?.user?.tenantId, req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  collections = async (req, res, next) => {
    try {
      const data = await this.service.getCollections(req.auth?.user?.tenantId, req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  collectionsTrend = async (req, res, next) => {
    try {
      const data = await this.service.getCollectionsTrend(req.auth?.user?.tenantId, req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  profile = async (req, res, next) => {
    try {
      const data = await this.service.getAgentProfile(req.auth?.user?.tenantId, req.params.id);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  salesHistory = async (req, res, next) => {
    try {
      const data = await this.service.getAgentSalesHistory(req.auth?.user?.tenantId, req.params.id, req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  collectionHistory = async (req, res, next) => {
    try {
      const data = await this.service.getAgentCollectionHistory(req.auth?.user?.tenantId, req.params.id, req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  remittanceLedger = async (req, res, next) => {
    try {
      const data = await this.service.getAgentRemittanceLedger(req.auth?.user?.tenantId, req.params.id, req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  collectionQueue = async (req, res, next) => {
    try {
      const data = await this.service.getCollectionQueue(req.auth?.user?.tenantId, req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  remittanceReview = async (req, res, next) => {
    try {
      const data = await this.service.getRemittanceReview(req.auth?.user?.tenantId, req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };
}
