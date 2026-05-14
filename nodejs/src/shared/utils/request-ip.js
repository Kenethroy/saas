function firstHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalized[0] ?? null;
}

export function resolveRequestIp(req) {
  return {
    clientIp: req.ip ?? null,
    forwardedFor: firstHeaderValue(req.headers["x-forwarded-for"]),
    realIp: firstHeaderValue(req.headers["x-real-ip"]),
    cfConnectingIp: firstHeaderValue(req.headers["cf-connecting-ip"]),
    remoteAddress: req.socket?.remoteAddress ?? req.connection?.remoteAddress ?? null,
    trustedProxyHops: req.app?.get("trust proxy") ?? 0,
    proxyChain: Array.isArray(req.ips) ? req.ips : []
  };
}

export function getPersistedRequestIp(req) {
  const resolved = resolveRequestIp(req);
  return resolved.realIp || resolved.forwardedFor || resolved.cfConnectingIp || resolved.clientIp || resolved.remoteAddress || null;
}
