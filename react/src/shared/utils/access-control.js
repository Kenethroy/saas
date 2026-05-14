export function isAdminUser(user) {
  return String(user?.role ?? "").toLowerCase() === "admin";
}

export function hasPermission(user, permission) {
  if (!permission) {
    return true;
  }

  if (isAdminUser(user)) {
    return true;
  }

  const permissions = Array.isArray(user?.permissions) ? user.permissions : [];
  return permissions.includes(permission);
}

export function hasAnyPermission(user, permissions = []) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return true;
  }

  if (isAdminUser(user)) {
    return true;
  }

  return permissions.some((permission) => hasPermission(user, permission));
}

export function hasAllPermissions(user, permissions = []) {
  if (!Array.isArray(permissions) || permissions.length === 0) {
    return true;
  }

  if (isAdminUser(user)) {
    return true;
  }

  return permissions.every((permission) => hasPermission(user, permission));
}

export function canAccess(user, { permission = null, permissions = [], requireAny = false } = {}) {
  if (isAdminUser(user)) {
    return true;
  }

  if (permission) {
    return hasPermission(user, permission);
  }

  if (permissions.length > 0) {
    return requireAny ? hasAnyPermission(user, permissions) : hasAllPermissions(user, permissions);
  }

  return true;
}
