import { hasPermission } from "#shared/permissions/policy";

export function requireRole(role) {
  return (req, res, next) => {
    const currentUser = req.auth?.user;

    if (!currentUser) {
      return res.status(401).json({
        message: "Unauthenticated"
      });
    }

    if (currentUser.role !== role) {
      return res.status(403).json({
        message: "Forbidden"
      });
    }

    next();
  };
}

export function requirePermission(slug) {
  return async (req, res, next) => {
    const currentUser = req.auth?.user;

    if (!currentUser) {
      return res.status(401).json({
        message: "Unauthenticated"
      });
    }

    const allowed = await hasPermission(currentUser.id, currentUser.role, slug);

    if (!allowed) {
      return res.status(403).json({
        message: "Forbidden"
      });
    }

    next();
  };
}

export function requireAnyPermission(slugs) {
  return async (req, res, next) => {
    const currentUser = req.auth?.user;

    if (!currentUser) {
      return res.status(401).json({
        message: "Unauthenticated"
      });
    }

    for (const slug of slugs) {
      // eslint-disable-next-line no-await-in-loop
      const allowed = await hasPermission(currentUser.id, currentUser.role, slug);
      if (allowed) {
        next();
        return;
      }
    }

    return res.status(403).json({
      message: "Forbidden"
    });
  };
}
