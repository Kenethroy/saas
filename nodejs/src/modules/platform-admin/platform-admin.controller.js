import { successResponse } from "#shared/utils/response";
import { PlatformAdminService } from "#modules/platform-admin/platform-admin.service";

export class PlatformAdminController {
  constructor(service = new PlatformAdminService()) {
    this.service = service;
  }

  login = async (req, res, next) => {
    try {
      const result = await this.service.login(req.body);
      res.status(200).json(
        successResponse({
          message: "Platform admin login successful",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  currentAccount = async (req, res, next) => {
    try {
      const result = await this.service.currentAccount(req.auth.account.id);
      res.status(200).json(
        successResponse({
          message: "Platform admin account retrieved successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  listTenants = async (req, res, next) => {
    try {
      const result = await this.service.listTenants(req.query);
      res.status(200).json(
        successResponse({
          message: "Tenants retrieved successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };
}

