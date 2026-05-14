import { AppError } from "#shared/utils/app-error";

export function requirePlatformRole(allowedRoles = []) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, _res, next) => {
    const accountRoles = req?.auth?.account?.roles ?? [];
    const hasRole = roles.length === 0
      ? Array.isArray(accountRoles) && accountRoles.length > 0
      : roles.some((role) => accountRoles.includes(role));

    if (!hasRole) {
      return next(new AppError("Forbidden", 403));
    }

    next();
  };
}

