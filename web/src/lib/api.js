const API_BASE_URL = (import.meta.env.VITE_PLATFORM_API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");

function withQuery(path, params = {}) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function request(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers ?? {})
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    throw new Error(payload?.message || "Request failed");
  }

  return payload?.data ?? null;
}

export const platformApi = {
  register(input) {
    return request("/platform/accounts/register", {
      method: "POST",
      body: input
    });
  },
  login(input) {
    return request("/platform/auth/login", {
      method: "POST",
      body: input
    });
  },
  me(token) {
    return request("/platform/auth/me", { token });
  },
  startOnboarding(token, input) {
    return request("/platform/onboarding/start", {
      method: "POST",
      token,
      body: input
    });
  },
  listPlans() {
    return request("/platform/plans");
  },
  createCheckout(token, input) {
    return request("/platform/subscriptions/checkout", {
      method: "POST",
      token,
      body: input
    });
  },
  confirmCheckout(token, input) {
    return request("/platform/subscriptions/checkout/confirm", {
      method: "POST",
      token,
      body: input
    });
  },
  getOnboardingStatus(token, onboardingId) {
    return request(`/platform/onboarding/${onboardingId}/status`, { token });
  }
};

export const platformAdminApi = {
  login(input) {
    return request("/platform/admin/auth/login", {
      method: "POST",
      body: input
    });
  },
  me(token) {
    return request("/platform/admin/auth/me", { token });
  },
  listSubscriptions(token, params) {
    return request(withQuery("/platform/admin/subscriptions", params), { token });
  },
  listOnboardingAudits(token, params) {
    return request(withQuery("/platform/admin/onboarding-audit", params), { token });
  },
  getOnboardingAudit(token, onboardingId) {
    return request(`/platform/admin/onboarding-audit/${onboardingId}`, { token });
  },
  getTenantBilling(token, tenantId) {
    return request(`/platform/admin/tenants/${tenantId}/billing`, { token });
  },
  applySubscriptionAction(token, tenantId, input) {
    return request(`/platform/admin/tenants/${tenantId}/subscription-action`, {
      method: "POST",
      token,
      body: input
    });
  },
  listPlans(token) {
    return request("/platform/admin/plans", { token });
  },
  updatePlan(token, planId, input) {
    return request(`/platform/admin/plans/${planId}`, {
      method: "PATCH",
      token,
      body: input
    });
  },
  updatePlanPrice(token, priceId, input) {
    return request(`/platform/admin/plan-prices/${priceId}`, {
      method: "PATCH",
      token,
      body: input
    });
  }
};
