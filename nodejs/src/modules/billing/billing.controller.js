import { successResponse } from "#shared/utils/response";
import { BillingService } from "#modules/billing/billing.service";

export class BillingController {
  constructor(service = new BillingService()) {
    this.service = service;
  }

  checkout = async (req, res, next) => {
    try {
      const result = await this.service.checkout(req.auth.account.id, req.body);
      res.status(201).json(
        successResponse({
          message: "Checkout session created successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  confirmCheckout = async (req, res, next) => {
    try {
      const result = await this.service.confirmCheckout(req.auth.account.id, req.body);
      res.status(200).json(
        successResponse({
          message: "Checkout confirmation processed successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  xenditWebhook = async (req, res, next) => {
    try {
      const result = await this.service.handleXenditWebhook(req.body, req.headers);
      res.status(200).json(
        successResponse({
          message: "Xendit webhook processed",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  stripeWebhook = async (req, res, next) => {
    try {
      const result = await this.service.handleStripeWebhook(req.body, req.headers, req.rawBody ?? "");
      res.status(200).json(
        successResponse({
          message: "Stripe webhook processed",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
