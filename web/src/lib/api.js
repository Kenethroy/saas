const API_BASE_URL = (import.meta.env.VITE_PLATFORM_API_BASE_URL || "http://localhost:4000").replace(/\/+$/, "");

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
  getOnboardingStatus(token, onboardingId) {
    return request(`/platform/onboarding/${onboardingId}/status`, { token });
  }
};
