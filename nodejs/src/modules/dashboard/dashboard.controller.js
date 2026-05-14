import { DashboardService } from "./dashboard.service.js";

export class DashboardController {
  constructor(service = new DashboardService()) {
    this.service = service;
  }

  overview = async (req, res, next) => {
    try {
      const data = await this.service.getOverview(req.query);
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
      const data = await this.service.getReceivablesCalendar(req.query);
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };

  notifications = async (_req, res, next) => {
    try {
      const data = await this.service.getNotifications();
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  };
}
