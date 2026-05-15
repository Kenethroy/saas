const SESSION_KEY = "saas-web-session";
const ADMIN_SESSION_KEY = "saas-web-admin-session";
const BUSINESS_DRAFT_KEY = "saas-web-business-draft";
const CHECKOUT_KEY = "saas-web-last-checkout";

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export const platformStorage = {
  getSession() {
    return readJson(SESSION_KEY, null);
  },
  setSession(value) {
    writeJson(SESSION_KEY, value);
  },
  clearSession() {
    window.localStorage.removeItem(SESSION_KEY);
  },
  getAdminSession() {
    return readJson(ADMIN_SESSION_KEY, null);
  },
  setAdminSession(value) {
    writeJson(ADMIN_SESSION_KEY, value);
  },
  clearAdminSession() {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
  },
  getBusinessDraft() {
    return readJson(BUSINESS_DRAFT_KEY, null);
  },
  setBusinessDraft(value) {
    writeJson(BUSINESS_DRAFT_KEY, value);
  },
  getCheckout() {
    return readJson(CHECKOUT_KEY, null);
  },
  setCheckout(value) {
    writeJson(CHECKOUT_KEY, value);
  }
};
