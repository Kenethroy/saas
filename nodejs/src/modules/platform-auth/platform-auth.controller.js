import { successResponse } from "#shared/utils/response";
import { PlatformAuthService } from "#modules/platform-auth/platform-auth.service";

export class PlatformAuthController {
  constructor(service = new PlatformAuthService()) {
    this.service = service;
  }

  register = async (req, res, next) => {
    try {
      const result = await this.service.register(req.body);
      res.status(201).json(
        successResponse({
          message: "Platform account registered successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  login = async (req, res, next) => {
    try {
      const result = await this.service.login(req.body);
      res.status(200).json(
        successResponse({
          message: "Platform login successful",
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
          message: "Platform account retrieved successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
