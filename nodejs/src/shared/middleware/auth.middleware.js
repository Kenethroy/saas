import { env } from "#config/env";
import { verifyAccessToken } from "#shared/auth/jwt";
import { touchSession, validateSession } from "#shared/auth/session";
import { getPersistedRequestIp } from "#shared/utils/request-ip";
import { ActivityLogsService } from "#modules/activity-logs/activity-logs.service";

function extractBearerToken(header) {
  if (!header) {
    return null;
  }

const match = header.match(/^Bearer\s+(.+)$/i);
return match ? match[1].trim() : header.trim();
}

function normalizeActivityAction(req) {
  const method = String(req.method || "").toUpperCase();
  const path = String(req.originalUrl || req.url || "").toLowerCase();

  if (method === "DELETE") return "delete";
  if (method === "PUT" || method === "PATCH") return "update";

  if (method === "POST") {
    if (path.includes("/create")) return "create";
    if (path.includes("/update")) return "update";
    if (path.includes("/delete") || path.includes("/remove")) return "delete";
    return null;
  }

  return null;
}

function getModuleFromRequest(req) {
  const path = String(req.originalUrl || req.url || "");
  const normalized = path.split("?")[0] || "";
  const afterApi = normalized.startsWith("/api/") ? normalized.slice(5) : normalized.replace(/^\/+/, "");
  const module = (afterApi.split("/")[0] || "system").trim();
  return module || "system";
}

function sanitizeMetadata(value) {
  if (!value || typeof value !== "object") return value;

  const input = Array.isArray(value) ? value : { ...value };
  const redactKeys = new Set(["password", "new_password", "old_password", "token", "access_token", "refresh_token"]);

  for (const key of Object.keys(input)) {
    if (redactKeys.has(String(key).toLowerCase())) {
      input[key] = "[REDACTED]";
    }
  }

  return input;
}

function safeJsonSize(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
  } catch {
    return Infinity;
  }
}

function truncateObject(value, maxBytes = 10 * 1024) {
  if (value === null || value === undefined) return value;

  const size = safeJsonSize(value);
  if (size <= maxBytes) return value;

  if (typeof value === "string") {
    return value.slice(0, Math.max(0, maxBytes - 20)) + "…[truncated]";
  }

  if (Array.isArray(value)) {
    const trimmed = value.slice(0, 50);
    return safeJsonSize(trimmed) <= maxBytes ? trimmed : trimmed.slice(0, 10);
  }

  if (typeof value === "object") {
    const keys = Object.keys(value).slice(0, 50);
    const next = {};
    for (const key of keys) next[key] = value[key];
    if (safeJsonSize(next) > maxBytes) {
      for (const key of Object.keys(next)) {
        if (typeof next[key] === "string") next[key] = next[key].slice(0, 200);
      }
    }
    return next;
  }

  return String(value);
}

function extractEntityInfo(req, responseBody) {
  const module = getModuleFromRequest(req);
  const entityIdFromParams = req.params?.id ?? req.params?.invoiceId ?? req.params?.customerId ?? null;

  const data = responseBody?.data ?? responseBody?.result ?? responseBody ?? null;

  const idCandidates = [
    data?.id,
    data?.payment_id,
    data?.accounts_payable_id,
    entityIdFromParams
  ];

  const entityId = idCandidates.find((v) => v !== undefined && v !== null && String(v).trim() !== "");
  const entityName = data?.name ?? data?.payment_number ?? data?.invoice_number ?? null;

  return {
    entity_type: module,
    entity_id: entityId != null ? String(entityId) : null,
    entity_name: entityName != null ? String(entityName) : null
  };
}

export async function authenticate(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        message: "Unauthenticated"
      });
    }

    const payload = verifyAccessToken(token);
    const session = await validateSession(token);

    const sessionUser = session?.user ?? null;
    if (!session || !sessionUser) {
      return res.status(401).json({
        message: "Unauthenticated"
      });
    }

    if (Number(sessionUser.id) !== Number(payload.userId)) {
      return res.status(401).json({
        message: "Unauthenticated"
      });
    }

    const touchIntervalMs = env.AUTH_SESSION_TOUCH_INTERVAL_MS || 30000;
    const lastSeenAt = session?.lastSeenAt instanceof Date ? session.lastSeenAt : (session?.lastSeenAt ? new Date(session.lastSeenAt) : null);
    const shouldTouch = !lastSeenAt || Date.now() - lastSeenAt.getTime() >= touchIntervalMs;

    if (shouldTouch) {
      await touchSession(token);
    }

    req.auth = {
      token,
      user: sessionUser
    };

    const action = normalizeActivityAction(req);
    const shouldLog = Boolean(action)
      && !String(req.originalUrl || "").startsWith("/api/activity/logs")
      && !String(req.originalUrl || "").startsWith("/health");

    if (shouldLog) {
      let responseBody = null;
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        responseBody = body;
        return originalJson(body);
      };

      res.on("finish", () => {
        if (res.statusCode >= 400) return;

        const activityLogs = new ActivityLogsService();
        const module = getModuleFromRequest(req);
        const userId = req.auth?.user?.id ?? null;
        if (!userId) return;

        const description = `${action.toUpperCase()} ${req.originalUrl}`;

        const isMultipart = String(req.headers["content-type"] ?? "").toLowerCase().includes("multipart/form-data");
        const metadata = truncateObject(sanitizeMetadata({
          params: req.params,
          query: req.query,
          body: isMultipart ? { has_file: true } : req.body,
          response: truncateObject(responseBody, 20 * 1024)
        }), 12 * 1024);

        const entity = extractEntityInfo(req, responseBody);

        Promise.resolve(activityLogs.log({
          userId,
          action,
          module,
          description: entity.entity_name ? `${description} (${entity.entity_name})` : description,
          metadata: {
            ...metadata,
            entity_id: entity.entity_id,
            entity_name: entity.entity_name
          },
          ipAddress: getPersistedRequestIp(req),
          userAgent: req.headers["user-agent"] ?? null
        })).catch(() => {});
      });
    }

    next();
  } catch (_error) {
    return res.status(401).json({
      message: "Unauthenticated"
    });
  }
}
