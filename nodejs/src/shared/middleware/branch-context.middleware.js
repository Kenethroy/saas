import { query } from "#shared/database/mysql";
import { AppError } from "#shared/utils/app-error";

function extractBranchId(req) {
  const raw = req.headers["x-branch-id"] ?? req.headers["x-branchid"] ?? null;
  if (raw === undefined || raw === null || raw === "") return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new AppError("Invalid branch id", 400);
  }
  return Math.trunc(parsed);
}

export async function resolveBranch(req, _res, next) {
  try {
    const branchId = extractBranchId(req);
    if (!branchId) {
      return next();
    }

    const tenantId = req.auth?.user?.tenantId ?? req.auth?.tenant?.id ?? null;
    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }

    const rows = await query(
      `
        SELECT id, tenant_id, code, name, is_primary, status
        FROM branches
        WHERE tenant_id = ?
          AND id = ?
          AND status = 'active'
        LIMIT 1
      `,
      [tenantId, branchId]
    );

    const branch = rows[0];
    if (!branch) {
      throw new AppError("Branch not found", 404);
    }

    req.auth = {
      ...(req.auth ?? {}),
      branch: {
        id: Number(branch.id),
        code: branch.code,
        name: branch.name,
        isPrimary: Boolean(branch.is_primary),
        status: branch.status
      }
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

