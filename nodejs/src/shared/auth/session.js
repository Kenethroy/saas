import crypto from "node:crypto";
import { query } from "#shared/database/mysql";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const SESSION_VALIDATION_CACHE_TTL_MS = 5_000;
const sessionValidationCache = new Map();

function getCachedValidation(tokenHash) {
  const cached = sessionValidationCache.get(tokenHash);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    sessionValidationCache.delete(tokenHash);
    return null;
  }
  return cached.value;
}

function setCachedValidation(tokenHash, session) {
  sessionValidationCache.set(tokenHash, {
    value: session,
    expiresAt: Date.now() + SESSION_VALIDATION_CACHE_TTL_MS
  });
}

export async function createSession({ userId, token, ipAddress = null, userAgent = null }) {
  const tokenHash = hashToken(token);
  const sql = `
    INSERT INTO user_sessions (user_id, token, token_hash, ip_address, user_agent, last_seen_at)
    VALUES (?, ?, ?, ?, ?, NOW())
  `;
  return query(sql, [userId, token, tokenHash, ipAddress, userAgent]);
}

export async function validateSession(token) {
  const tokenHash = hashToken(token);

  const cached = getCachedValidation(tokenHash);
  if (cached) {
    return cached;
  }

  const sql = `
    SELECT 
      s.last_seen_at as lastSeenAt,
      u.id,
      u.tenant_id as tenantId,
      u.account_id as accountId,
      u.employee_id as employeeId,
      u.username,
      u.email,
      u.role,
      u.status
    FROM user_sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token_hash = ?
      AND s.revoked_at IS NULL
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
      AND u.delete_flg = 0
      AND u.status = 1
    LIMIT 1
  `;

  const rows = await query(sql, [tokenHash]);
  const session = rows[0] || null;

  if (session) {
    // Reformat to match Prisma's nested structure if necessary, 
    // or keep it flat if the service expects it flat.
    // Looking at the Prisma select, it returns { lastSeenAt, user: { ... } }
    const formattedSession = {
      lastSeenAt: session.lastSeenAt,
      user: {
        id: session.id,
        tenantId: session.tenantId,
        accountId: session.accountId,
        employeeId: session.employeeId,
        username: session.username,
        email: session.email,
        role: session.role,
        status: session.status
      }
    };
    setCachedValidation(tokenHash, formattedSession);
    return formattedSession;
  }

  return null;
}

export async function touchSession(token) {
  const tokenHash = hashToken(token);
  const sql = `
    UPDATE user_sessions 
    SET last_seen_at = NOW()
    WHERE token_hash = ? AND revoked_at IS NULL
  `;
  const result = await query(sql, [tokenHash]);

  const cached = getCachedValidation(tokenHash);
  if (cached) {
    setCachedValidation(tokenHash, { ...cached, lastSeenAt: new Date() });
  }

  return result;
}

export async function revokeSession(token) {
  const tokenHash = hashToken(token);
  const sql = `
    UPDATE user_sessions 
    SET revoked_at = NOW()
    WHERE token_hash = ? AND revoked_at IS NULL
  `;
  const result = await query(sql, [tokenHash]);

  sessionValidationCache.delete(tokenHash);
  return result;
}

export async function listUserSessions(userId, currentToken) {
  const currentTokenHash = currentToken ? hashToken(currentToken) : null;
  const sql = `
    SELECT
      id,
      device_name AS deviceName,
      platform,
      user_agent AS userAgent,
      ip_address AS ipAddress,
      last_seen_at AS lastSeenAt,
      created_at AS createdAt,
      expires_at AS expiresAt,
      token_hash AS tokenHash
    FROM user_sessions
    WHERE user_id = ?
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY last_seen_at DESC, created_at DESC
  `;

  const rows = await query(sql, [userId]);

  return rows.map((row) => ({
    id: Number(row.id),
    deviceName: row.deviceName,
    platform: row.platform,
    userAgent: row.userAgent,
    ipAddress: row.ipAddress,
    lastSeenAt: row.lastSeenAt,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    current: currentTokenHash != null && row.tokenHash === currentTokenHash
  }));
}

export async function revokeOtherSessions(userId, currentToken) {
  const currentTokenHash = hashToken(currentToken);
  const sql = `
    UPDATE user_sessions
    SET revoked_at = NOW()
    WHERE user_id = ?
      AND revoked_at IS NULL
      AND token_hash <> ?
  `;

  const result = await query(sql, [userId, currentTokenHash]);

  for (const [tokenHash, cached] of sessionValidationCache.entries()) {
    if (cached?.value?.user?.id && Number(cached.value.user.id) === Number(userId) && tokenHash !== currentTokenHash) {
      sessionValidationCache.delete(tokenHash);
    }
  }

  return Number(result?.affectedRows ?? 0);
}
