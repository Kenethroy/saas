import { successResponse } from "#shared/utils/response";
import { TrucksService } from "#modules/trucks/trucks.service";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class TrucksController {
  constructor(service = new TrucksService()) {
    this.service = service;
  }

  list = async (req, res, next) => {
    try {
      const result = await this.service.list(req.auth?.user?.tenantId, req.query, {
        branchId: req.auth?.branch?.id ?? null
      });
      res.status(200).json(
        successResponse({
          message: "Trucks retrieved successfully",
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
      const data = await this.service.getById(req.auth?.user?.tenantId, req.params.id);
      res.status(200).json(
        successResponse({
          message: "Truck retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  listForAssignment = async (req, res, next) => {
    try {
      const data = await this.service.listForAssignment(req.auth?.user?.tenantId, req.query, {
        branchId: req.auth?.branch?.id ?? null
      });
      res.status(200).json(
        successResponse({
          message: "Truck list retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const data = await this.service.create(req.auth?.user?.tenantId, req.body, {
        branchId: req.auth?.branch?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(
        successResponse({
          message: "Truck created successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      await this.service.update(req.auth?.user?.tenantId, req.params.id, req.body, {
        branchId: req.auth?.branch?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Truck updated successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.service.delete(req.auth?.user?.tenantId, req.params.id, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Truck deleted successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
