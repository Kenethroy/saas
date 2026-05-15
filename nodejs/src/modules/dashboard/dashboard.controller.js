import { DashboardService } from "./dashboard.service.js";

export class DashboardController {
  constructor(service = new DashboardService()) {
    this.service = service;
  }

  getTenantId(req) {
    return req.auth?.user?.tenantId ?? null;
  }

  getBranchId(req) {
    return req.auth?.branch?.id ?? null;
  }

  overview = async (req, res, next) => {
    try {
      const data = await this.service.getOverview(this.getTenantId(req), req.query, {
        branchId: this.getBranchId(req)
      });
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  receivablesCalendar = async (req, res, next) => {
    try {
      const data = await this.service.getReceivablesCalendar(this.getTenantId(req), req.query, {
        branchId: this.getBranchId(req)
      });
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  notifications = async (req, res, next) => {
    try {
      const data = await this.service.getNotifications(this.getTenantId(req), {
        branchId: this.getBranchId(req)
      });
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };
}
