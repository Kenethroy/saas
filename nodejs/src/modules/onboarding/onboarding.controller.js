import { successResponse } from "#shared/utils/response";
import { OnboardingService } from "#modules/onboarding/onboarding.service";

export class OnboardingController {
  constructor(service = new OnboardingService()) {
    this.service = service;
  }

  start = async (req, res, next) => {
    try {
      const result = await this.service.start(req.auth.account.id, req.body);
      res.status(200).json(
        successResponse({
          message: "Onboarding started successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  status = async (req, res, next) => {
    try {
      const result = await this.service.status(req.auth.account.id, req.params.id);
      res.status(200).json(
        successResponse({
          message: "Onboarding status retrieved successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
