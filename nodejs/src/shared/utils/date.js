export const APP_TIMEZONE = "Asia/Manila";

export function getAppTimezone() {
  return APP_TIMEZONE;
}

export function nowIso() {
  return new Date().toISOString();
}
