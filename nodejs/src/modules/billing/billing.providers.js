import { env } from "#config/env";
import { AppError } from "#shared/utils/app-error";

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;

  return false;
}

function ensureCheckoutReturnUrl(value) {
  if (!value) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    return undefined;
  }

  if (parsed.protocol === "https:") {
    return parsed.toString();
  }

  if (parsed.protocol !== "http:") {
    return undefined;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === "localhost"
    || hostname === "::1"
    || isPrivateIpv4(hostname)
  ) {
    return parsed.toString();
  }

  return undefined;
}

function toStripeAmount(value) {
  return Math.round(Number(value) * 100);
}

function toFormBody(params) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    searchParams.append(key, String(value));
  }

  return searchParams;
}

export class StripeBillingProvider {
  constructor(config = env) {
    this.config = config;
  }

  async createCheckoutSession(payload) {
    if (!this.config.STRIPE_SECRET_KEY) {
      return this.createMockCheckoutSession(payload);
    }

    const successUrl = ensureCheckoutReturnUrl(this.config.PLATFORM_CHECKOUT_SUCCESS_URL);
    const cancelUrl = ensureCheckoutReturnUrl(this.config.PLATFORM_CHECKOUT_CANCEL_URL);

    if (!successUrl || !cancelUrl) {
      throw new AppError(
        "Stripe checkout requires configured success and cancel URLs. Use HTTPS for normal hosts, or HTTP only for localhost/private development URLs.",
        422
      );
    }

    const mode = payload.planPrice.checkoutMode === "payment" ? "payment" : "subscription";
    const body = toFormBody({
      mode,
      client_reference_id: payload.referenceId,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": payload.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": toStripeAmount(payload.amount),
      "line_items[0][price_data][product_data][name]": payload.planPrice.name,
      "line_items[0][price_data][product_data][description]": `${payload.planPrice.name} for ${payload.business.businessName}`,
      customer_email: payload.account.email,
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[checkout_flow]": payload.checkoutFlow ?? "signup",
      "metadata[onboarding_id]": payload.onboardingId,
      "metadata[account_id]": payload.account.id,
      "metadata[tenant_id]": payload.tenantId,
      "metadata[subscription_id]": payload.subscriptionId,
      "metadata[plan_code]": payload.plan.code,
      "metadata[plan_price_code]": payload.planPrice.code,
      "metadata[preferred_subdomain]": payload.business.preferredSubdomain,
      "subscription_data[metadata][checkout_flow]": payload.checkoutFlow ?? "signup",
      "subscription_data[metadata][onboarding_id]": payload.onboardingId,
      "subscription_data[metadata][account_id]": payload.account.id,
      "subscription_data[metadata][tenant_id]": payload.tenantId,
      "subscription_data[metadata][subscription_id]": payload.subscriptionId,
      "subscription_data[metadata][plan_code]": payload.plan.code,
      "subscription_data[metadata][plan_price_code]": payload.planPrice.code,
      "subscription_data[metadata][preferred_subdomain]": payload.business.preferredSubdomain
    });

    if (mode === "subscription") {
      body.set("line_items[0][price_data][recurring][interval]", payload.planPrice.billingIntervalUnit);
      body.set("line_items[0][price_data][recurring][interval_count]", payload.planPrice.billingIntervalCount);
    } else {
      body.delete("subscription_data[metadata][checkout_flow]");
      body.delete("subscription_data[metadata][onboarding_id]");
      body.delete("subscription_data[metadata][account_id]");
      body.delete("subscription_data[metadata][tenant_id]");
      body.delete("subscription_data[metadata][subscription_id]");
      body.delete("subscription_data[metadata][plan_code]");
      body.delete("subscription_data[metadata][plan_price_code]");
      body.delete("subscription_data[metadata][preferred_subdomain]");
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body,
      signal: AbortSignal.timeout(this.config.BILLING_PROVIDER_TIMEOUT_MS)
    });

    const rawText = await response.text();
    const raw = rawText ? JSON.parse(rawText) : null;

    if (!response.ok) {
      throw new AppError(raw?.error?.message || "Stripe checkout session creation failed", 502, raw);
    }

    return {
      provider: "stripe",
      mode: "live",
      referenceId: payload.referenceId,
      checkoutMode: mode,
      paymentSessionId: raw?.id ?? null,
      paymentLinkUrl: raw?.url ?? null,
      status: raw?.status ?? "open",
      raw
    };
  }

  async getCheckoutSession(paymentSessionId) {
    if (!paymentSessionId) {
      throw new AppError("Stripe checkout session id is required", 422);
    }

    if (!this.config.STRIPE_SECRET_KEY) {
      throw new AppError("Stripe checkout confirmation requires a configured secret key", 422);
    }

    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(paymentSessionId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.config.STRIPE_SECRET_KEY}`
      },
      signal: AbortSignal.timeout(this.config.BILLING_PROVIDER_TIMEOUT_MS)
    });

    const rawText = await response.text();
    const raw = rawText ? JSON.parse(rawText) : null;

    if (!response.ok) {
      throw new AppError(raw?.error?.message || "Stripe checkout session retrieval failed", 502, raw);
    }

    return {
      provider: "stripe",
      paymentSessionId: raw?.id ?? paymentSessionId,
      referenceId: raw?.client_reference_id ?? null,
      status: raw?.status ?? null,
      paymentStatus: raw?.payment_status ?? null,
      customerId: raw?.customer ?? null,
      subscriptionId: raw?.subscription ?? null,
      amount: raw?.amount_total === undefined || raw?.amount_total === null
        ? null
        : Number(raw.amount_total) / 100,
      currency: raw?.currency ? String(raw.currency).toUpperCase() : null,
      raw
    };
  }

  createMockCheckoutSession(payload) {
    const paymentSessionId = `cs_test_mock_${Date.now()}`;
    const mode = payload.planPrice.checkoutMode === "payment" ? "payment" : "subscription";
    const subscriptionId = mode === "subscription" ? `sub_test_mock_${Date.now()}` : null;
    const customerId = `cus_test_mock_${Date.now()}`;

    return {
      provider: "stripe",
      mode: "mock",
      referenceId: payload.referenceId,
      checkoutMode: mode,
      paymentSessionId,
      paymentLinkUrl: null,
      status: "open",
      raw: {
        id: paymentSessionId,
        url: null,
        status: "open",
        subscription: subscriptionId,
        customer: customerId
      }
    };
  }
}

export class XenditBillingProvider {
  constructor(config = env) {
    this.config = config;
  }

  async createCheckoutSession(payload) {
    if (!this.config.XENDIT_SECRET_KEY) {
      return this.createMockCheckoutSession(payload);
    }

    const body = {
      reference_id: payload.referenceId,
      session_type: "PAY",
      mode: "PAYMENT_LINK",
      amount: payload.amount,
      currency: payload.currency,
      country: payload.country,
      customer: {
        reference_id: `account_${payload.account.id}`,
        type: "INDIVIDUAL",
        email: payload.account.email,
        mobile_number: payload.business.phone ?? undefined,
        individual_detail: {
          given_names: payload.account.firstName || payload.business.businessName,
          surname: payload.account.lastName || "Owner"
        }
      },
      locale: "en",
      description: `${payload.plan.name} subscription for ${payload.business.businessName}`,
      success_return_url: ensureCheckoutReturnUrl(this.config.PLATFORM_CHECKOUT_SUCCESS_URL),
      cancel_return_url: ensureCheckoutReturnUrl(this.config.PLATFORM_CHECKOUT_CANCEL_URL),
      items: [
        {
          reference_id: payload.plan.code,
          type: "DIGITAL_SERVICE",
          name: `${payload.plan.name} subscription`,
          net_unit_amount: payload.amount,
          quantity: 1,
          category: "subscription",
          description: `${payload.billingCycle} subscription checkout`
        }
      ],
      metadata: {
        checkout_flow: payload.checkoutFlow ?? "signup",
        onboarding_id: String(payload.onboardingId),
        account_id: String(payload.account.id),
        tenant_id: payload.tenantId ? String(payload.tenantId) : undefined,
        subscription_id: payload.subscriptionId ? String(payload.subscriptionId) : undefined,
        plan_code: payload.plan.code,
        billing_cycle: payload.billingCycle,
        preferred_subdomain: payload.business.preferredSubdomain
      }
    };

    const response = await fetch("https://api.xendit.co/sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.XENDIT_SECRET_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.BILLING_PROVIDER_TIMEOUT_MS)
    });

    const rawText = await response.text();
    const raw = rawText ? JSON.parse(rawText) : null;

    if (!response.ok) {
      throw new AppError(raw?.message || "Xendit session creation failed", 502, raw);
    }

    return {
      provider: "xendit",
      mode: "live",
      referenceId: payload.referenceId,
      checkoutMode: "payment",
      paymentSessionId: raw?.payment_session_id ?? null,
      paymentLinkUrl: raw?.payment_link_url ?? null,
      status: raw?.status ?? "ACTIVE",
      raw
    };
  }

  async getCheckoutSession(_paymentSessionId) {
    throw new AppError("Xendit checkout confirmation is currently webhook-only", 422);
  }

  createMockCheckoutSession(payload) {
    const paymentSessionId = `mock_ps_${Date.now()}`;

    return {
      provider: "xendit",
      mode: "mock",
      referenceId: payload.referenceId,
      checkoutMode: "payment",
      paymentSessionId,
      paymentLinkUrl: null,
      status: "ACTIVE",
      raw: {
        payment_session_id: paymentSessionId,
        reference_id: payload.referenceId,
        status: "ACTIVE",
        payment_link_url: null
      }
    };
  }
}

export function createBillingProvider(provider) {
  if (provider === "stripe") {
    return new StripeBillingProvider();
  }

  if (provider === "xendit") {
    return new XenditBillingProvider();
  }

  throw new AppError(`Unsupported billing provider: ${provider}`, 422);
}
