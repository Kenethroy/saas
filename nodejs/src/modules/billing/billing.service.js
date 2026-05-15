import crypto from "node:crypto";
import { env } from "#config/env";
import { AppError } from "#shared/utils/app-error";
import { BillingRepository } from "#modules/billing/billing.repository";
import { createBillingProvider } from "#modules/billing/billing.providers";
import { OnboardingRepository } from "#modules/onboarding/onboarding.repository";
import { PlatformAuthRepository } from "#modules/platform-auth/platform-auth.repository";

function resolveBillingCycle(planPrice) {
  if (planPrice.billingIntervalUnit === "month" && planPrice.billingIntervalCount === 1) {
    return "monthly";
  }

  if (planPrice.billingIntervalUnit === "year" && planPrice.billingIntervalCount === 1) {
    return "yearly";
  }

  return "custom";
}

function buildReferenceId(onboardingId) {
  return `onb_${onboardingId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function buildRenewalReferenceId(tenantId) {
  return `ren_${tenantId}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

function resolveWebhookEventId(event, data) {
  return `session:${data.payment_session_id}:${event}`;
}

function resolveProviderPaymentId(data) {
  return data.payment_id || data.payment_request_id || data.payment_session_id;
}

function addBillingInterval(date, planPrice) {
  const next = new Date(date);

  if (planPrice.billingIntervalUnit === "month") {
    next.setMonth(next.getMonth() + planPrice.billingIntervalCount);
    return next;
  }

  if (planPrice.billingIntervalUnit === "year") {
    next.setFullYear(next.getFullYear() + planPrice.billingIntervalCount);
    return next;
  }

  return next;
}

function parseStripeSignatureHeader(value) {
  const entries = String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const result = {
    timestamp: null,
    signatures: []
  };

  for (const entry of entries) {
    const [key, ...rest] = entry.split("=");
    const joined = rest.join("=");
    if (key === "t") {
      result.timestamp = joined;
    } else if (key === "v1") {
      result.signatures.push(joined);
    }
  }

  return result;
}

export class BillingService {
  constructor(
    repository = new BillingRepository(),
    onboardingRepository = new OnboardingRepository(),
    platformAuthRepository = new PlatformAuthRepository()
  ) {
    this.repository = repository;
    this.onboardingRepository = onboardingRepository;
    this.platformAuthRepository = platformAuthRepository;
  }

  async requireActivePlatformAccount(accountId) {
    const account = await this.platformAuthRepository.findAccountById(accountId);
    if (!account || !["pending", "active"].includes(account.status)) {
      throw new AppError("Unauthenticated", 401);
    }

    return account;
  }

  async requireTenantBillingContext(auth) {
    const tenantId = auth?.tenant?.id;
    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }

    const context = await this.repository.findTenantBillingContext(tenantId);
    if (!context) {
      throw new AppError("Tenant billing context not found", 404);
    }

    return context;
  }

  async getTenantSubscriptionContext(auth) {
    const context = await this.requireTenantBillingContext(auth);

    return {
      account: auth?.account ?? null,
      tenant: context.tenant,
      membership: auth?.membership ?? null,
      subscription: context.subscription,
      availablePlanPrices: context.availablePlanPrices,
      recoveryEligible: context.recoveryEligible
    };
  }

  async getTenantBillingContext(auth) {
    const context = await this.requireTenantBillingContext(auth);

    return {
      account: auth?.account ?? null,
      tenant: context.tenant,
      membership: auth?.membership ?? null,
      subscription: context.subscription,
      latestInvoice: context.latestInvoice,
      latestPayment: context.latestPayment,
      providerCustomer: context.providerCustomer,
      providerSubscription: context.providerSubscription,
      availablePlanPrices: context.availablePlanPrices,
      recoveryEligible: context.recoveryEligible
    };
  }

  async completeSignupPayment(payload) {
    const onboarding = await this.onboardingRepository.findStatusByAccountId(payload.draft.accountId);
    const paidAt = payload.paidAt instanceof Date ? payload.paidAt : new Date(payload.paidAt);
    const currentPeriodEnd = addBillingInterval(paidAt, payload.draft.planPrice);

    if (onboarding?.tenantId) {
      const latestSubscription = onboarding.subscription?.id
        ? { id: onboarding.subscription.id }
        : await this.repository.findLatestTenantSubscription(onboarding.tenantId);

      if (!latestSubscription?.id) {
        throw new AppError("Provisioned subscription not found", 500);
      }

      await this.repository.attachBillingArtifacts({
        tenantId: onboarding.tenantId,
        subscriptionId: latestSubscription.id,
        accountId: payload.draft.accountId,
        provider: payload.provider,
        planPriceId: payload.draft.planPrice.id,
        providerSubscriptionId: payload.providerSubscriptionId ?? null,
        providerPaymentId: payload.providerPaymentId,
        providerCustomerId: payload.providerCustomerId ?? null,
        providerPlanId: payload.draft.planPrice.providerPriceId ?? payload.draft.planPrice.code,
        referenceId: payload.draft.referenceId,
        amount: Number(payload.amount),
        currency: String(payload.currency).toUpperCase(),
        email: payload.draft.business.businessEmail ?? null,
        billingCycle: payload.draft.billingCycle,
        currentPeriodStart: paidAt,
        currentPeriodEnd,
        paidAt
      });

      await this.repository.activateTenantSubscriptionState(onboarding.tenantId);

      if (payload.webhookEventId) {
        await this.repository.markProviderEventStatus(payload.provider, payload.webhookEventId, "processed", {
          tenantId: onboarding.tenantId,
          subscriptionId: latestSubscription.id
        });
      }

      if (payload.checkoutEventId) {
        await this.repository.markProviderEventStatus(payload.provider, payload.checkoutEventId, "processed", {
          tenantId: onboarding.tenantId,
          subscriptionId: latestSubscription.id
        });
      }

      return {
        duplicate: false,
        status: "processed",
        tenantId: onboarding.tenantId,
        subscriptionId: latestSubscription.id
      };
    }

    await this.onboardingRepository.markPaymentConfirmed(payload.draft.accountId);

    const provisioning = await this.repository.provisionTenant({
      accountId: payload.draft.accountId,
      planCode: payload.draft.planCode,
      provider: payload.provider,
      providerSubscriptionId: payload.providerSubscriptionId ?? null,
      subscriptionStatus: "active",
      billingCycle: payload.draft.billingCycle,
      businessName: payload.draft.business.businessName,
      legalName: payload.draft.business.legalName,
      businessType: payload.draft.business.businessType,
      phone: payload.draft.business.phone,
      businessEmail: payload.draft.business.businessEmail,
      address: payload.draft.business.address,
      currencyCode: payload.draft.business.currencyCode,
      timezone: payload.draft.business.timezone,
      preferredSubdomain: payload.draft.business.preferredSubdomain,
      baseDomain: env.PLATFORM_BASE_DOMAIN || null,
      ownerUsername: payload.draft.business.ownerUsername,
      primaryBranchName: payload.draft.business.primaryBranchName
    });

    if (!provisioning) {
      throw new AppError("Tenant provisioning did not return a result", 500);
    }

    const latestSubscription = await this.repository.findLatestTenantSubscription(provisioning.tenantId);
    if (!latestSubscription) {
      throw new AppError("Provisioned subscription not found", 500);
    }

    await this.repository.attachBillingArtifacts({
      tenantId: provisioning.tenantId,
      subscriptionId: latestSubscription.id,
      accountId: payload.draft.accountId,
      provider: payload.provider,
      planPriceId: payload.draft.planPrice.id,
      providerSubscriptionId: payload.providerSubscriptionId ?? null,
      providerPaymentId: payload.providerPaymentId,
      providerCustomerId: payload.providerCustomerId ?? null,
      providerPlanId: payload.draft.planPrice.providerPriceId ?? payload.draft.planPrice.code,
      referenceId: payload.draft.referenceId,
      amount: Number(payload.amount),
      currency: String(payload.currency).toUpperCase(),
      email: payload.draft.business.businessEmail ?? null,
      billingCycle: payload.draft.billingCycle,
      currentPeriodStart: paidAt,
      currentPeriodEnd,
      paidAt
    });

    await this.repository.activateTenantSubscriptionState(provisioning.tenantId);

    if (payload.webhookEventId) {
      await this.repository.markProviderEventStatus(payload.provider, payload.webhookEventId, "processed", {
        tenantId: provisioning.tenantId,
        subscriptionId: latestSubscription.id
      });
    }

    if (payload.checkoutEventId) {
      await this.repository.markProviderEventStatus(payload.provider, payload.checkoutEventId, "processed", {
        tenantId: provisioning.tenantId,
        subscriptionId: latestSubscription.id
      });
    }

    return {
      duplicate: false,
      status: "processed",
      tenantId: provisioning.tenantId,
      subscriptionId: latestSubscription.id
    };
  }

  async checkout(accountId, payload) {
    const account = await this.requireActivePlatformAccount(accountId);

    await this.onboardingRepository.ensureOnboardingRecord(accountId);
    await this.onboardingRepository.start(accountId, payload.preferredSubdomain);

    const onboarding = await this.onboardingRepository.findStatusByAccountId(accountId);
    if (!onboarding) {
      throw new AppError("Onboarding state not found", 404);
    }

    if (onboarding.tenantId) {
      throw new AppError("This account already has a provisioned tenant", 409);
    }

    const selected = await this.repository.findPlanPriceByCode(payload.planPriceCode);
    if (!selected?.plan || !selected?.planPrice) {
      throw new AppError("Subscription plan price not found", 404);
    }

    const { plan, planPrice } = selected;
    const amount = planPrice.price;

    if (amount === null || amount === undefined) {
      throw new AppError("Selected plan requires manual pricing and cannot use self-service checkout", 422);
    }

    if (
      payload.provider === "stripe"
      && planPrice.checkoutMode === "subscription"
      && planPrice.billingIntervalUnit === "year"
      && planPrice.billingIntervalCount > 3
    ) {
      throw new AppError("Stripe recurring subscriptions support a maximum 3 year interval", 422);
    }

    const referenceId = buildReferenceId(onboarding.id);
    const provider = createBillingProvider(payload.provider);
    const billingCycle = resolveBillingCycle(planPrice);
    const providerSession = await provider.createCheckoutSession({
      referenceId,
      onboardingId: onboarding.id,
      account: {
        id: account.id,
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName
      },
      plan,
      planPrice,
      billingCycle,
      amount,
      currency: payload.currencyCode || "PHP",
      country: "PH",
      business: {
        businessName: payload.businessName,
        legalName: payload.legalName ?? null,
        businessType: payload.businessType ?? null,
        phone: payload.phone ?? null,
        businessEmail: payload.businessEmail ?? null,
        address: payload.address ?? null,
        currencyCode: payload.currencyCode || "PHP",
        timezone: payload.timezone || "Asia/Manila",
        preferredSubdomain: payload.preferredSubdomain,
        ownerUsername: payload.ownerUsername,
        primaryBranchName: payload.primaryBranchName ?? null
      }
    });

    await this.repository.createCheckoutDraft({
      provider: payload.provider,
      eventId: `checkout:${referenceId}`,
      data: {
        provider: payload.provider,
        referenceId,
        onboardingId: onboarding.id,
        accountId,
        planCode: plan.code,
        planPriceCode: planPrice.code,
        planPrice,
        billingCycle,
        amount,
        currency: payload.currencyCode || "PHP",
        business: {
          businessName: payload.businessName,
          legalName: payload.legalName ?? null,
          businessType: payload.businessType ?? null,
          phone: payload.phone ?? null,
          businessEmail: payload.businessEmail ?? null,
          address: payload.address ?? null,
          currencyCode: payload.currencyCode || "PHP",
          timezone: payload.timezone || "Asia/Manila",
          preferredSubdomain: payload.preferredSubdomain,
          ownerUsername: payload.ownerUsername,
          primaryBranchName: payload.primaryBranchName ?? null
        },
        providerSession
      }
    });

    await this.onboardingRepository.markPlanSelectedAndAwaitingPayment(accountId, payload.preferredSubdomain);

    return {
      provider: payload.provider,
      providerMode: providerSession.mode,
      referenceId,
      onboardingId: onboarding.id,
      planCode: plan.code,
      planPriceCode: planPrice.code,
      amount,
      currency: payload.currencyCode || "PHP",
      paymentSessionId: providerSession.paymentSessionId,
      paymentLinkUrl: providerSession.paymentLinkUrl,
      checkoutMode: providerSession.checkoutMode,
      status: providerSession.status,
      mockWebhookPayload: providerSession.mode === "mock"
        ? payload.provider === "stripe"
          ? {
              id: `evt_mock_${Date.now()}`,
              type: "checkout.session.completed",
              data: {
                object: {
                  id: providerSession.paymentSessionId,
                  client_reference_id: referenceId,
                  customer: providerSession.raw.customer,
                  subscription: providerSession.raw.subscription,
                  payment_status: "paid",
                  status: "complete",
                  currency: (payload.currencyCode || "PHP").toLowerCase(),
                  amount_total: Math.round(amount * 100),
                  metadata: {
                    onboarding_id: String(onboarding.id),
                    account_id: String(accountId),
                    plan_code: plan.code,
                    plan_price_code: planPrice.code,
                    preferred_subdomain: payload.preferredSubdomain
                  }
                }
              }
            }
          : {
              event: "payment_session.completed",
              created: new Date().toISOString(),
              data: {
                payment_session_id: providerSession.paymentSessionId,
                reference_id: referenceId,
                status: "COMPLETED",
                amount,
                currency: payload.currencyCode || "PHP",
                customer_id: `mock_customer_${accountId}`,
                payment_id: `mock_payment_${Date.now()}`
              }
            }
        : null
    };
  }

  async confirmCheckout(accountId, payload) {
    await this.requireActivePlatformAccount(accountId);

    const checkoutDraft = await this.repository.findCheckoutDraftByReferenceId(payload.provider, payload.referenceId);
    if (!checkoutDraft?.payload) {
      throw new AppError("Checkout draft not found", 404);
    }

    const draft = checkoutDraft.payload;
    if (Number(draft.accountId) !== Number(accountId)) {
      throw new AppError("Forbidden", 403);
    }

    const paymentSessionId = payload.paymentSessionId ?? draft.providerSession?.paymentSessionId ?? null;
    if (!paymentSessionId) {
      throw new AppError("Checkout draft is missing a payment session id", 422);
    }

    if (
      draft.providerSession?.paymentSessionId
      && paymentSessionId !== draft.providerSession.paymentSessionId
    ) {
      throw new AppError("Checkout confirmation session does not match the draft", 422);
    }

    const provider = createBillingProvider(payload.provider);
    const session = await provider.getCheckoutSession(paymentSessionId);

    if (
      session.referenceId
      && String(session.referenceId).trim()
      && String(session.referenceId).trim() !== String(draft.referenceId).trim()
    ) {
      throw new AppError("Checkout confirmation reference does not match the draft", 422);
    }

    if (payload.provider === "stripe") {
      if (session.status !== "complete" || session.paymentStatus !== "paid") {
        return {
          confirmed: false,
          status: session.status ?? "pending",
          paymentStatus: session.paymentStatus ?? null,
          referenceId: draft.referenceId,
          paymentSessionId
        };
      }

      const result = draft.flow === "renewal"
        ? await this.completeRenewalPayment({
            provider: "stripe",
            draft,
            checkoutEventId: checkoutDraft.eventId,
            webhookEventId: null,
            providerSubscriptionId: session.subscriptionId ?? null,
            providerPaymentId: session.paymentSessionId,
            providerCustomerId: session.customerId ?? null,
            amount: session.amount ?? draft.amount,
            currency: session.currency ?? draft.currency,
            paidAt: new Date()
          })
        : await this.completeSignupPayment({
            provider: "stripe",
            draft,
            checkoutEventId: checkoutDraft.eventId,
            webhookEventId: null,
            providerSubscriptionId: session.subscriptionId ?? null,
            providerPaymentId: session.paymentSessionId,
            providerCustomerId: session.customerId ?? null,
            amount: session.amount ?? draft.amount,
            currency: session.currency ?? draft.currency,
            paidAt: new Date()
          });

      return {
        confirmed: true,
        ...result
      };
    }

    throw new AppError(`Unsupported checkout confirmation provider: ${payload.provider}`, 422);
  }

  async renewTenantSubscription(auth, payload) {
    const accountId = auth?.account?.id;
    const account = await this.requireActivePlatformAccount(accountId);
    const context = await this.requireTenantBillingContext(auth);

    if (!context.subscription?.id || !context.subscription.plan?.id) {
      throw new AppError("Tenant subscription not found", 404);
    }

    if (!context.recoveryEligible) {
      throw new AppError("This tenant already has an active subscription", 409);
    }

    const selectedPlanPriceCode = payload.planPriceCode ?? context.subscription.planPrice?.code;
    if (!selectedPlanPriceCode) {
      throw new AppError("Plan price selection is required for renewal", 422);
    }

    const selected = await this.repository.findPlanPriceByCode(selectedPlanPriceCode);
    if (!selected?.plan || !selected?.planPrice) {
      throw new AppError("Subscription plan price not found", 404);
    }

    const { plan, planPrice } = selected;
    if (plan.id !== context.subscription.plan.id) {
      throw new AppError("Renewal checkout currently supports the tenant's current plan only", 422);
    }

    const amount = planPrice.price;
    if (amount === null || amount === undefined) {
      throw new AppError("Selected plan requires manual pricing and cannot use self-service checkout", 422);
    }

    if (
      payload.provider === "stripe"
      && planPrice.checkoutMode === "subscription"
      && planPrice.billingIntervalUnit === "year"
      && planPrice.billingIntervalCount > 3
    ) {
      throw new AppError("Stripe recurring subscriptions support a maximum 3 year interval", 422);
    }

    const referenceId = buildRenewalReferenceId(context.tenant.id);
    const provider = createBillingProvider(payload.provider);
    const billingCycle = resolveBillingCycle(planPrice);
    const currency = planPrice.currencyCode || context.tenant.currencyCode || "PHP";
    const providerSession = await provider.createCheckoutSession({
      referenceId,
      onboardingId: null,
      tenantId: context.tenant.id,
      subscriptionId: context.subscription.id,
      checkoutFlow: "renewal",
      account: {
        id: account.id,
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName
      },
      plan,
      planPrice,
      billingCycle,
      amount,
      currency,
      country: "PH",
      business: {
        businessName: context.tenant.name,
        legalName: context.tenant.legalName ?? null,
        businessType: context.tenant.businessType ?? null,
        phone: context.tenant.phone ?? null,
        businessEmail: context.tenant.email ?? account.email,
        address: context.tenant.address ?? null,
        currencyCode: currency,
        timezone: context.tenant.timezone || "Asia/Manila",
        preferredSubdomain: context.tenant.subdomain || context.tenant.slug,
        ownerUsername: null,
        primaryBranchName: null
      }
    });

    await this.repository.createCheckoutDraft({
      provider: payload.provider,
      eventId: `checkout:${referenceId}`,
      data: {
        flow: "renewal",
        provider: payload.provider,
        referenceId,
        onboardingId: null,
        tenantId: context.tenant.id,
        subscriptionId: context.subscription.id,
        accountId,
        planCode: plan.code,
        planPriceCode: planPrice.code,
        planPrice,
        billingCycle,
        amount,
        currency,
        business: {
          businessName: context.tenant.name,
          legalName: context.tenant.legalName ?? null,
          businessType: context.tenant.businessType ?? null,
          phone: context.tenant.phone ?? null,
          businessEmail: context.tenant.email ?? account.email,
          address: context.tenant.address ?? null,
          currencyCode: currency,
          timezone: context.tenant.timezone || "Asia/Manila",
          preferredSubdomain: context.tenant.subdomain || context.tenant.slug,
          ownerUsername: null,
          primaryBranchName: null
        },
        providerSession
      }
    });

    return {
      provider: payload.provider,
      providerMode: providerSession.mode,
      referenceId,
      tenantId: context.tenant.id,
      subscriptionId: context.subscription.id,
      planCode: plan.code,
      planPriceCode: planPrice.code,
      amount,
      currency,
      paymentSessionId: providerSession.paymentSessionId,
      paymentLinkUrl: providerSession.paymentLinkUrl,
      checkoutMode: providerSession.checkoutMode,
      status: providerSession.status,
      recoveryEligible: true,
      mockWebhookPayload: providerSession.mode === "mock"
        ? payload.provider === "stripe"
          ? {
              id: `evt_mock_${Date.now()}`,
              type: "checkout.session.completed",
              data: {
                object: {
                  id: providerSession.paymentSessionId,
                  client_reference_id: referenceId,
                  customer: providerSession.raw.customer,
                  subscription: providerSession.raw.subscription,
                  payment_status: "paid",
                  status: "complete",
                  currency: currency.toLowerCase(),
                  amount_total: Math.round(amount * 100),
                  metadata: {
                    checkout_flow: "renewal",
                    account_id: String(accountId),
                    tenant_id: String(context.tenant.id),
                    subscription_id: String(context.subscription.id),
                    plan_code: plan.code,
                    plan_price_code: planPrice.code,
                    preferred_subdomain: context.tenant.subdomain || context.tenant.slug
                  }
                }
              }
            }
          : {
              event: "payment_session.completed",
              created: new Date().toISOString(),
              data: {
                payment_session_id: providerSession.paymentSessionId,
                reference_id: referenceId,
                status: "COMPLETED",
                amount,
                currency,
                customer_id: `mock_customer_${accountId}`,
                payment_id: `mock_payment_${Date.now()}`
              }
            }
        : null
    };
  }

  async handleStripeWebhook(payload, headers = {}, rawBody = "") {
    this.assertStripeWebhook(headers, rawBody);

    const eventType = String(payload.type || "").trim();
    const session = payload.data?.object || {};
    const referenceId = String(session.client_reference_id || "").trim();
    const webhookEventId = `stripe:${payload.id}`;

    const existingEvent = await this.repository.findProviderEvent("stripe", webhookEventId);
    if (existingEvent) {
      return {
        duplicate: true,
        status: existingEvent.status
      };
    }

    await this.repository.createProviderWebhookEvent({
      provider: "stripe",
      eventId: webhookEventId,
      eventType,
      data: payload
    });

    try {
      if (eventType === "checkout.session.expired") {
        await this.repository.markProviderEventStatus("stripe", webhookEventId, "ignored");
        return { duplicate: false, status: "ignored" };
      }

      if (eventType !== "checkout.session.completed") {
        await this.repository.markProviderEventStatus("stripe", webhookEventId, "ignored");
        return { duplicate: false, status: "ignored" };
      }

      if (!referenceId) {
        throw new AppError("Stripe checkout session missing client_reference_id", 422);
      }

      const checkoutDraft = await this.repository.findCheckoutDraftByReferenceId("stripe", referenceId);
      if (!checkoutDraft?.payload) {
        throw new AppError("Checkout draft not found for Stripe reference", 422);
      }

      const draft = checkoutDraft.payload;
      if (draft.flow === "renewal") {
        return this.completeRenewalPayment({
          provider: "stripe",
          draft,
          checkoutEventId: checkoutDraft.eventId,
          webhookEventId,
          providerSubscriptionId: session.subscription ?? null,
          providerPaymentId: session.id,
          providerCustomerId: session.customer ?? null,
          amount: Number((session.amount_total ?? (draft.amount * 100)) / 100),
          currency: String(session.currency ?? draft.currency).toUpperCase(),
          paidAt: new Date()
        });
      }

      return this.completeSignupPayment({
        provider: "stripe",
        draft,
        checkoutEventId: checkoutDraft.eventId,
        webhookEventId,
        providerSubscriptionId: session.subscription ?? null,
        providerPaymentId: session.id,
        providerCustomerId: session.customer ?? null,
        amount: Number((session.amount_total ?? (draft.amount * 100)) / 100),
        currency: String(session.currency ?? draft.currency).toUpperCase(),
        paidAt: new Date()
      });
    } catch (error) {
      await this.repository.markProviderEventStatus("stripe", webhookEventId, "failed");
      throw error;
    }
  }

  async handleXenditWebhook(payload, headers = {}) {
    this.assertXenditWebhook(headers);

    const event = String(payload.event || "").trim();
    const data = payload.data || {};
    const webhookEventId = resolveWebhookEventId(event, data);

    const existingEvent = await this.repository.findProviderEvent("xendit", webhookEventId);
    if (existingEvent) {
      return {
        duplicate: true,
        status: existingEvent.status
      };
    }

    await this.repository.createProviderWebhookEvent({
      provider: "xendit",
      eventId: webhookEventId,
      eventType: event,
      data: payload
    });

    try {
      if (event === "payment_session.expired") {
        await this.repository.markProviderEventStatus("xendit", webhookEventId, "ignored");
        return { duplicate: false, status: "ignored" };
      }

      if (event !== "payment_session.completed") {
        await this.repository.markProviderEventStatus("xendit", webhookEventId, "ignored");
        return { duplicate: false, status: "ignored" };
      }

      const checkoutDraft = await this.repository.findCheckoutDraftByReferenceId("xendit", data.reference_id);
      if (!checkoutDraft?.payload) {
        throw new AppError("Checkout draft not found for webhook reference", 422);
      }

      const draft = checkoutDraft.payload;
      if (draft.flow === "renewal") {
        return this.completeRenewalPayment({
          provider: "xendit",
          draft,
          checkoutEventId: checkoutDraft.eventId,
          webhookEventId,
          providerSubscriptionId: data.payment_session_id,
          providerPaymentId: resolveProviderPaymentId(data),
          providerCustomerId: data.customer_id ?? null,
          amount: Number(data.amount ?? draft.amount),
          currency: data.currency ?? draft.currency,
          paidAt: data.updated ? new Date(data.updated) : new Date()
        });
      }

      return this.completeSignupPayment({
        provider: "xendit",
        draft,
        checkoutEventId: checkoutDraft.eventId,
        webhookEventId,
        providerSubscriptionId: data.payment_session_id,
        providerPaymentId: resolveProviderPaymentId(data),
        providerCustomerId: data.customer_id ?? null,
        amount: Number(data.amount ?? draft.amount),
        currency: data.currency ?? draft.currency,
        paidAt: data.updated ? new Date(data.updated) : new Date()
      });
    } catch (error) {
      await this.repository.markProviderEventStatus("xendit", webhookEventId, "failed");
      throw error;
    }
  }

  async completeRenewalPayment(payload) {
    const tenantId = Number(payload.draft.tenantId ?? 0);
    if (!tenantId) {
      throw new AppError("Renewal checkout draft is missing tenant context", 422);
    }

    const subscriptionId = Number(payload.draft.subscriptionId ?? 0);
    const latestSubscription = subscriptionId
      ? { id: subscriptionId }
      : await this.repository.findLatestTenantSubscription(tenantId);

    if (!latestSubscription?.id) {
      throw new AppError("Renewal subscription not found", 404);
    }

    const paidAt = payload.paidAt instanceof Date ? payload.paidAt : new Date(payload.paidAt);
    const currentPeriodEnd = addBillingInterval(paidAt, payload.draft.planPrice);

    await this.repository.attachBillingArtifacts({
      tenantId,
      subscriptionId: latestSubscription.id,
      accountId: payload.draft.accountId,
      provider: payload.provider,
      planPriceId: payload.draft.planPrice.id,
      providerSubscriptionId: payload.providerSubscriptionId ?? null,
      providerPaymentId: payload.providerPaymentId,
      providerCustomerId: payload.providerCustomerId ?? null,
      providerPlanId: payload.draft.planPrice.providerPriceId ?? payload.draft.planPrice.code,
      referenceId: payload.draft.referenceId,
      amount: Number(payload.amount),
      currency: String(payload.currency).toUpperCase(),
      email: payload.draft.business.businessEmail ?? null,
      billingCycle: payload.draft.billingCycle,
      currentPeriodStart: paidAt,
      currentPeriodEnd,
      paidAt
    });

    await this.repository.activateTenantSubscriptionState(tenantId);

    if (payload.webhookEventId) {
      await this.repository.markProviderEventStatus(payload.provider, payload.webhookEventId, "processed", {
        tenantId,
        subscriptionId: latestSubscription.id
      });
    }

    if (payload.checkoutEventId) {
      await this.repository.markProviderEventStatus(payload.provider, payload.checkoutEventId, "processed", {
        tenantId,
        subscriptionId: latestSubscription.id
      });
    }

    return {
      duplicate: false,
      status: "processed",
      tenantId,
      subscriptionId: latestSubscription.id
    };
  }

  assertXenditWebhook(headers) {
    const expectedToken = env.XENDIT_WEBHOOK_TOKEN || "";
    if (!expectedToken) return;

    const providedToken = String(headers["x-callback-token"] ?? headers["X-Callback-Token"] ?? "").trim();
    if (providedToken !== expectedToken) {
      throw new AppError("Invalid Xendit webhook token", 401);
    }
  }

  assertStripeWebhook(headers, rawBody) {
    const secret = env.STRIPE_WEBHOOK_SECRET || "";
    if (!secret) return;

    const signatureHeader = String(
      headers["stripe-signature"]
        ?? headers["Stripe-Signature"]
        ?? ""
    ).trim();

    if (!signatureHeader || !rawBody) {
      throw new AppError("Invalid Stripe webhook signature", 401);
    }

    const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
    if (!timestamp || signatures.length === 0) {
      throw new AppError("Invalid Stripe webhook signature", 401);
    }

    const ageMs = Math.abs(Date.now() - (Number(timestamp) * 1000));
    if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) {
      throw new AppError("Expired Stripe webhook timestamp", 401);
    }

    const signedPayload = `${timestamp}.${rawBody}`;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(signedPayload, "utf8")
      .digest("hex");

    const matched = signatures.some((signature) => {
      const expectedBuffer = Buffer.from(expected, "hex");
      const actualBuffer = Buffer.from(signature, "hex");
      return expectedBuffer.length === actualBuffer.length
        && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    });

    if (!matched) {
      throw new AppError("Invalid Stripe webhook signature", 401);
    }
  }
}
