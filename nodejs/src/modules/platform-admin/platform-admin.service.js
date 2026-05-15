import bcrypt from "bcryptjs";
import { AppError } from "#shared/utils/app-error";
import { signAccessToken } from "#shared/auth/jwt";
import { PlatformAuthRepository } from "#modules/platform-auth/platform-auth.repository";
import { PlatformAdminRepository } from "#modules/platform-admin/platform-admin.repository";
import { BillingRepository } from "#modules/billing/billing.repository";

function normalizeAccount(account, roles) {
  return {
    id: Number(account.id),
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    status: account.status,
    roles: roles ?? []
  };
}

export class PlatformAdminService {
  constructor(
    authRepository = new PlatformAuthRepository(),
    repository = new PlatformAdminRepository(),
    billingRepository = new BillingRepository()
  ) {
    this.authRepository = authRepository;
    this.repository = repository;
    this.billingRepository = billingRepository;
  }

  async login(payload) {
    const account = await this.authRepository.findAccountByEmail(payload.credential);
    if (!account || !["pending", "active"].includes(account.status)) {
      throw new AppError("Invalid credentials", 401);
    }

    const matches = await bcrypt.compare(payload.password, String(account.passwordHash ?? "").trim());
    if (!matches) {
      throw new AppError("Invalid credentials", 401);
    }

    const roles = await this.authRepository.listActiveRolesByAccountId(account.id);
    if (!roles.length) {
      throw new AppError("Forbidden", 403);
    }

    await this.authRepository.touchLastLogin(account.id);

    const token = signAccessToken({
      scope: "platform",
      accountId: Number(account.id)
    });

    return {
      token,
      account: normalizeAccount(account, roles)
    };
  }

  async currentAccount(accountId) {
    const account = await this.authRepository.findAccountById(accountId);
    if (!account || !["pending", "active"].includes(account.status)) {
      throw new AppError("Unauthenticated", 401);
    }

    const roles = await this.authRepository.listActiveRolesByAccountId(account.id);
    if (!roles.length) {
      throw new AppError("Forbidden", 403);
    }

    return {
      account: normalizeAccount(account, roles)
    };
  }

  async listTenants(query) {
    const filters = {
      q: query.q,
      status: query.status,
      subscriptionStatus: query.subscriptionStatus
    };

    const paging = {
      page: query.page,
      perPage: query.perPage
    };

    const total = await this.repository.countTenants(filters);
    const items = await this.repository.listTenants(filters, paging);

    return {
      items,
      page: paging.page,
      perPage: paging.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / paging.perPage))
    };
  }

  async listPlans() {
    return this.repository.listPlans();
  }

  async listSubscriptions(query) {
    const filters = {
      q: query.q,
      status: query.status,
      tenantStatus: query.tenantStatus,
      provider: query.provider,
      planCode: query.planCode
    };

    const paging = {
      page: query.page,
      perPage: query.perPage
    };

    const total = await this.repository.countSubscriptionReviews(filters);
    const items = await this.repository.listSubscriptionReviews(filters, paging);

    return {
      items,
      page: paging.page,
      perPage: paging.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / paging.perPage))
    };
  }

  async listOnboardingAudits(query) {
    const filters = {
      q: query.q,
      currentStep: query.currentStep,
      tenantStatus: query.tenantStatus,
      domainStatus: query.domainStatus
    };

    const paging = {
      page: query.page,
      perPage: query.perPage
    };

    const total = await this.repository.countOnboardingAudits(filters);
    const items = await this.repository.listOnboardingAudits(filters, paging);

    return {
      items,
      page: paging.page,
      perPage: paging.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / paging.perPage))
    };
  }

  async getTenantBilling(tenantId) {
    const context = await this.billingRepository.findTenantBillingContext(tenantId);
    if (!context) {
      throw new AppError("Tenant billing context not found", 404);
    }

    return context;
  }

  async getOnboardingAudit(onboardingId) {
    const audit = await this.repository.findOnboardingAuditById(onboardingId);
    if (!audit) {
      throw new AppError("Onboarding audit record not found", 404);
    }

    return audit;
  }

  async applySubscriptionAction(tenantId, accountId, payload) {
    const result = await this.repository.setTenantSubscriptionAccess(tenantId, {
      action: payload.action,
      reason: payload.reason ?? null,
      platformAccountId: accountId
    });

    if (!result?.tenantExists) {
      throw new AppError("Tenant not found", 404);
    }

    if (!result?.subscriptionExists) {
      throw new AppError("Tenant subscription not found", 404);
    }

    return this.getTenantBilling(tenantId);
  }

  async updatePlan(planId, payload) {
    const plan = await this.repository.updatePlan(planId, payload);
    if (!plan) {
      throw new AppError("Subscription plan not found", 404);
    }

    return plan;
  }

  async updatePlanPrice(priceId, payload) {
    const planPrice = await this.repository.updatePlanPrice(priceId, payload);
    if (!planPrice) {
      throw new AppError("Subscription plan price not found", 404);
    }

    return planPrice;
  }
}
