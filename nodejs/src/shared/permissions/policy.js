import { query } from "#shared/database/mysql";

const ADMIN_PERMISSIONS_CACHE_KEY = "admin:all";
const ADMIN_PERMISSIONS_TTL_MS = 5 * 60 * 1000;
const ROLE_PERMISSIONS_TTL_MS = 5 * 60 * 1000;
const USER_PERMISSIONS_TTL_MS = 60 * 1000;

const permissionsCache = new Map();

function getCached(key) {
  const entry = permissionsCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    permissionsCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value, ttlMs) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
  permissionsCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

export async function getUserPermissionSlugs(userId, role) {
  if (role === "admin") {
    const cached = getCached(ADMIN_PERMISSIONS_CACHE_KEY);
    if (cached) {
      return cached;
    }

    const sql = "SELECT slug FROM permissions WHERE delete_flg = 0 AND status = 1";
    const permissions = await query(sql);

    const slugs = permissions.map((p) => p.slug);
    setCached(ADMIN_PERMISSIONS_CACHE_KEY, slugs, ADMIN_PERMISSIONS_TTL_MS);
    return slugs;
  }

  const userCacheKey = `user:${String(userId)}:${role}`;
  const cachedUser = getCached(userCacheKey);
  if (cachedUser) {
    return cachedUser;
  }

  // Check user-specific permissions (overrides)
  const userSql = `
    SELECT p.slug 
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = ? AND p.delete_flg = 0 AND p.status = 1
  `;
  const overrides = await query(userSql, [userId]);

  if (overrides.length > 0) {
    const slugs = overrides.map((p) => p.slug);
    setCached(userCacheKey, slugs, USER_PERMISSIONS_TTL_MS);
    return slugs;
  }

  // Fallback to role-based permissions
  const roleCacheKey = `role:${role}`;
  const cachedRole = getCached(roleCacheKey);
  if (cachedRole) {
    setCached(userCacheKey, cachedRole, USER_PERMISSIONS_TTL_MS);
    return cachedRole;
  }

  const roleSql = `
    SELECT p.slug 
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role = ? AND p.delete_flg = 0 AND p.status = 1
  `;
  const permissions = await query(roleSql, [role]);

  const slugs = permissions.map((p) => p.slug);
  setCached(roleCacheKey, slugs, ROLE_PERMISSIONS_TTL_MS);
  setCached(userCacheKey, slugs, USER_PERMISSIONS_TTL_MS);
  return slugs;
}

export async function hasPermission(userId, role, slug) {
  if (role === "admin") {
    return true;
  }

  const slugs = await getUserPermissionSlugs(userId, role);
  return slugs.includes(slug);
}
