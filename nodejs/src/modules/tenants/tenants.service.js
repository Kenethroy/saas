import { BillingService } from "#modules/billing/billing.service";

export class TenantsService {
  constructor(billingService = new BillingService()) {
    this.billingService = billingService;
  }

  currentContext(auth) {
    return {
      account: auth?.account ?? null,
      tenant: auth?.tenant ?? null,
      membership: auth?.membership ?? null,
      subscription: auth?.subscription ?? null
    };
  }

  currentAccess(auth) {
    return {
      access: true,
      account: auth?.account ?? null,
      tenant: auth?.tenant ?? null,
      membership: auth?.membership ?? null,
      subscription: auth?.subscription ?? null
    };
  }

  async currentSubscription(auth) {
    return this.billingService.getTenantSubscriptionContext(auth);
  }

  async currentBilling(auth) {
    return this.billingService.getTenantBillingContext(auth);
  }

  async renew(auth, payload) {
    return this.billingService.renewTenantSubscription(auth, payload);
  }
}
