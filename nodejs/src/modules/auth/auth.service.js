import bcrypt from "bcryptjs";
import { AppError } from "#shared/utils/app-error";
import { signAccessToken } from "#shared/auth/jwt";
import { createSession, listUserSessions, revokeOtherSessions, revokeSession } from "#shared/auth/session";
import { getUserPermissionSlugs } from "#shared/permissions/policy";
import { AuthRepository } from "#modules/auth/auth.repository";
import { ActivityLogsService } from "#modules/activity-logs/activity-logs.service";

function normalizeAuthUser(user, permissions = [], workspace = null) {
  return {
    id: Number(user.id),
    tenantId: user.tenantId ? Number(user.tenantId) : null,
    accountId: user.accountId ? Number(user.accountId) : null,
    employeeId: user.employeeId ? Number(user.employeeId) : null,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    permissions,
    tenant: workspace?.tenant ?? null,
    subscription: workspace?.subscription ?? null,
    currentBranch: workspace?.currentBranch ?? null,
    branches: Array.isArray(workspace?.branches) ? workspace.branches : [],
    subscriptionAccess: workspace?.subscriptionAccess ?? {
      status: null,
      isActive: true
    },
    employee: user.employee
      ? {
          id: Number(user.employee.id),
          firstName: user.employee.firstName,
          lastName: user.employee.lastName,
          position: user.employee.position,
          email: user.employee.email
        }
      : null
  };
}

export class AuthService {
  constructor(repository = new AuthRepository()) {
    this.repository = repository;
    this.activityLogs = new ActivityLogsService();
  }

  async buildWorkspaceContext(user) {
    if (!user?.tenantId) {
      return null;
    }

    return this.repository.findWorkspaceContextByTenantId(user.tenantId);
  }

  async register(payload, context = {}) {
    const userCount = await this.repository.countUsers();
    if (userCount > 0) {
      throw new AppError("Public registration is disabled after bootstrap", 403);
    }

    if (await this.repository.findUserByUsername(payload.username)) {
      throw new AppError("Username already exists", 409);
    }

    if (await this.repository.findUserByEmail(payload.email)) {
      throw new AppError("Email already exists", 409);
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    const user = await this.repository.registerInitialUser({
      ...payload,
      passwordHash,
      ipAddress: context.ipAddress ?? null
    });

    // LOG REGISTRATION
    await this.activityLogs.log({
      userId: user.id,
      action: 'CREATE',
      module: 'AUTH',
      description: `Initial administrative account ${user.username} registered`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    const permissions = await getUserPermissionSlugs(user.id, user.role);
    const workspace = await this.buildWorkspaceContext(user);

    return normalizeAuthUser(user, permissions, workspace);
  }

  async login(payload, context = {}) {
    const user = await this.repository.findUserByCredential(payload.credential);

    if (!user || user.deleteFlag || !user.status) {
      throw new AppError("Invalid credentials", 401);
    }

    const passwordHash = typeof user.passwordHash === "string" ? user.passwordHash.trim() : user.passwordHash;
    const matches = await bcrypt.compare(payload.password, passwordHash);

    if (!matches) {
      throw new AppError("Invalid credentials", 401);
    }

    const token = signAccessToken({
      userId: Number(user.id),
      role: user.role
    });

    await createSession({
      userId: user.id,
      token,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null
    });

    // LOG LOGIN
    await this.activityLogs.log({
      userId: user.id,
      action: 'LOGIN',
      module: 'AUTH',
      description: `User ${user.username} logged in`,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });

    const permissions = await getUserPermissionSlugs(user.id, user.role);
    const workspace = await this.buildWorkspaceContext(user);

    return {
      token,
      user: normalizeAuthUser(user, permissions, workspace)
    };
  }

  async logout(token) {
    await revokeSession(token);
  }

  async currentUser(userId) {
    const user = await this.repository.findUserById(userId);

    if (!user || user.deleteFlag || !user.status) {
      throw new AppError("Unauthenticated", 401);
    }

    const permissions = await getUserPermissionSlugs(user.id, user.role);
    return normalizeAuthUser(user, permissions);
  }

  async listSessions(userId, currentToken) {
    const user = await this.repository.findUserById(userId);

    if (!user || user.deleteFlag || !user.status) {
      throw new AppError("Unauthenticated", 401);
    }

    return listUserSessions(user.id, currentToken);
  }

  async logoutOtherSessions(userId, currentToken) {
    const user = await this.repository.findUserById(userId);

    if (!user || user.deleteFlag || !user.status) {
      throw new AppError("Unauthenticated", 401);
    }

    const revokedCount = await revokeOtherSessions(user.id, currentToken);

    await this.activityLogs.log({
      userId: user.id,
      action: "LOGOUT",
      module: "AUTH",
      description: `User ${user.username} revoked other active sessions`
    });

    return {
      revokedCount
    };
  }
}
