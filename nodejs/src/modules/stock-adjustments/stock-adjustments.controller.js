import { StockAdjustmentsService } from "#modules/stock-adjustments/stock-adjustments.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class StockAdjustmentsController {
  constructor(service = new StockAdjustmentsService()) {
    this.service = service;
  }

  list = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const result = await this.service.list(tenantId, req.query, {
        branchId: req.auth?.branch?.id ?? null
      });
      res.status(200).json(
        successResponse({
          message: "Stock adjustments retrieved successfully",
          data: result.data,
          meta: result.meta
        })
      );
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await this.service.getById(tenantId, req.params.id);
      res.status(200).json(
        successResponse({
          message: "Stock adjustment retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await this.service.create(req.body, {
        tenantId,
        branchId: req.auth?.branch?.id ?? null,
        userId: req.auth?.user?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(
        successResponse({
          message: "Stock adjustment created successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await this.service.update(req.params.id, req.body, {
        tenantId,
        branchId: req.auth?.branch?.id ?? null,
        userId: req.auth?.user?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Stock adjustment updated successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  submit = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await this.service.submit(tenantId, req.params.id, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Stock adjustment submitted successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  approve = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await this.service.approve(tenantId, req.params.id, {
        userId: req.auth?.user?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Stock adjustment approved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  reject = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      const data = await this.service.reject(tenantId, req.params.id, req.body.reason, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Stock adjustment rejected successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      const tenantId = req.auth?.user?.tenantId ?? null;
      await this.service.delete(tenantId, req.params.id, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Stock adjustment deleted successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
