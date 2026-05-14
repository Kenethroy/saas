import { successResponse } from "#shared/utils/response";
import { SubscriptionsService } from "#modules/subscriptions/subscriptions.service";

export class SubscriptionsController {
  constructor(service = new SubscriptionsService()) {
    this.service = service;
  }

  listPlans = async (_req, res, next) => {
    try {
      const result = await this.service.listPlans();
      res.status(200).json(
        successResponse({
          message: "Subscription plans retrieved successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
