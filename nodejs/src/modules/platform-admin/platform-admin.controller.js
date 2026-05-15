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

  listSubscriptions = async (req, res, next) => {
    try {
      const result = await this.service.listSubscriptions(req.query);
      res.status(200).json(
        successResponse({
          message: "Subscriptions retrieved successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  listOnboardingAudits = async (req, res, next) => {
    try {
      const result = await this.service.listOnboardingAudits(req.query);
      res.status(200).json(
        successResponse({
          message: "Onboarding audits retrieved successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  tenantBilling = async (req, res, next) => {
    try {
      const result = await this.service.getTenantBilling(req.params.id);
      res.status(200).json(
        successResponse({
          message: "Tenant billing state retrieved successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  onboardingAudit = async (req, res, next) => {
    try {
      const result = await this.service.getOnboardingAudit(req.params.id);
      res.status(200).json(
        successResponse({
          message: "Onboarding audit retrieved successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  applySubscriptionAction = async (req, res, next) => {
    try {
      const result = await this.service.applySubscriptionAction(req.params.id, req.auth.account.id, req.body);
      const actionLabel = req.body.action === "reactivate" ? "reactivated" : "suspended";
      res.status(200).json(
        successResponse({
          message: `Tenant subscription ${actionLabel} successfully`,
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

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

  updatePlan = async (req, res, next) => {
    try {
      const result = await this.service.updatePlan(req.params.id, req.body);
      res.status(200).json(
        successResponse({
          message: "Subscription plan updated successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  updatePlanPrice = async (req, res, next) => {
    try {
      const result = await this.service.updatePlanPrice(req.params.id, req.body);
      res.status(200).json(
        successResponse({
          message: "Subscription plan price updated successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
