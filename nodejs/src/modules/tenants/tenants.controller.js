import { successResponse } from "#shared/utils/response";
import { TenantsService } from "#modules/tenants/tenants.service";

export class TenantsController {
  constructor(service = new TenantsService()) {
    this.service = service;
  }

  current = async (req, res, next) => {
    try {
      res.status(200).json(
        successResponse({
          message: "Tenant context retrieved successfully",
          data: this.service.currentContext(req.auth)
        })
      );
    } catch (error) {
      next(error);
    }
  };

  currentAccess = async (req, res, next) => {
    try {
      res.status(200).json(
        successResponse({
          message: "Tenant access validated successfully",
          data: this.service.currentAccess(req.auth)
        })
      );
    } catch (error) {
      next(error);
    }
  };

  currentSubscription = async (req, res, next) => {
    try {
      res.status(200).json(
        successResponse({
          message: "Tenant subscription retrieved successfully",
          data: await this.service.currentSubscription(req.auth)
        })
      );
    } catch (error) {
      next(error);
    }
  };

  currentBilling = async (req, res, next) => {
    try {
      res.status(200).json(
        successResponse({
          message: "Tenant billing state retrieved successfully",
          data: await this.service.currentBilling(req.auth)
        })
      );
    } catch (error) {
      next(error);
    }
  };

  renew = async (req, res, next) => {
    try {
      res.status(201).json(
        successResponse({
          message: "Tenant renewal checkout created successfully",
          data: await this.service.renew(req.auth, req.body)
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
