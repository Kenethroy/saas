import { ActivityLogsService } from "#modules/activity-logs/activity-logs.service";
import { successResponse } from "#shared/utils/response";

export class ActivityLogsController {
  constructor(service = new ActivityLogsService()) {
    this.service = service;
  }

  getLogs = async (req, res, next) => {
    try {
      const filters = {
        tenantId: req.auth?.user?.tenantId,
        branchId: req.auth?.branch?.id ?? null,
        search: req.query.search,
        action: req.query.action,
        dateFrom: req.query.date_from,
        limit: req.query.limit ? parseInt(req.query.limit) : 100,
        page: req.query.page ? parseInt(req.query.page) : 1,
      };
      
      const result = await this.service.getLogs(req.auth?.user?.tenantId, filters, {
        branchId: req.auth?.branch?.id ?? null
      });
      res.status(200).json(
        successResponse({
          message: 'Activity logs retrieved successfully',
          data: result.data,
          meta: result.meta
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
