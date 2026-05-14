import { ReportsService } from "#modules/reports/reports.service";

const service = new ReportsService();

export const reportsController = {
  async salesSummary(req, res, next) {
    try {
      const data = await service.getSalesSummary(req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async purchaseSummary(req, res, next) {
    try {
      const data = await service.getPurchaseSummary(req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async profitLoss(req, res, next) {
    try {
      const data = await service.getProfitLoss(req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  },

  async inventoryVelocity(req, res, next) {
    try {
      const result = await service.getInventoryVelocity(req.query);
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        summary: result.summary
      });
    } catch (error) {
      next(error);
    }
  }
};
