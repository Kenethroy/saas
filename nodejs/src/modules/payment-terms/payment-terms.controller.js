import { successResponse } from "#shared/utils/response";
import { PaymentTermsService } from "#modules/payment-terms/payment-terms.service";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class PaymentTermsController {
  constructor(service = new PaymentTermsService()) {
    this.service = service;
  }

  getTenantId(req) {
    return req.auth?.user?.tenantId ?? null;
  }

  list = async (req, res, next) => {
    try {
      const data = await this.service.list(this.getTenantId(req), req.query);
      res.status(200).json(
        successResponse({
          message: "Payment terms retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.service.getById(this.getTenantId(req), req.params.id);
      res.status(200).json(
        successResponse({
          message: "Payment term retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const data = await this.service.create(this.getTenantId(req), req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(
        successResponse({
          message: "Payment term created successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      await this.service.update(this.getTenantId(req), req.params.id, req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Payment term updated successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.service.delete(this.getTenantId(req), req.params.id, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Payment term deleted successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
