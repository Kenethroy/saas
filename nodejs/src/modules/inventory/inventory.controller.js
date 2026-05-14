import { InventoryService } from "#modules/inventory/inventory.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class InventoryController {
  constructor(service = new InventoryService()) {
    this.service = service;
  }

  applyStockAdjustment = async (req, res, next) => {
    try {
      const data = await this.service.applyStockAdjustment(req.body, {
        userId: req.auth?.user?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });

      res.status(200).json(
        successResponse({
          message: "Stock adjustment applied successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  listTransactions = async (req, res, next) => {
    try {
      const result = await this.service.listTransactions(req.query);
      res.status(200).json(
        successResponse({
          message: "Inventory transactions retrieved successfully",
          data: result.data,
          meta: result.meta
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
