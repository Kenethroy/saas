import { ReportsService } from "#modules/reports/reports.service";

const service = new ReportsService();
const getTenantId = (req) => req.auth?.user?.tenantId ?? null;
const getBranchId = (req) => req.auth?.branch?.id ?? null;

export const reportsController = {
  async salesSummary(req, res, next) {
    try {
      const data = await service.getSalesSummary(getTenantId(req), req.query, {
        branchId: getBranchId(req)
      });
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
      const data = await service.getPurchaseSummary(getTenantId(req), req.query, {
        branchId: getBranchId(req)
      });
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
      const data = await service.getProfitLoss(getTenantId(req), req.query, {
        branchId: getBranchId(req)
      });
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
      const result = await service.getInventoryVelocity(getTenantId(req), req.query, {
        branchId: getBranchId(req)
      });
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
