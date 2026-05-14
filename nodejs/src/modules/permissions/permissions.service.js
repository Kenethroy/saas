import { AppError } from "#shared/utils/app-error";
import { PermissionsRepository } from "#modules/permissions/permissions.repository";

function normalizePermission(permission) {
  return {
    id: Number(permission.id),
    slug: permission.slug,
    name: permission.name,
    description: permission.description,
    module: permission.slug.includes(".") ? permission.slug.split(".")[0] : "general",
    status: permission.status
  };
}

function normalizePermissionLink(link) {
  return {
    id: Number(link.permission.id),
    slug: link.permission.slug,
    name: link.permission.name
  };
}

export class PermissionsService {
  constructor(repository = new PermissionsRepository()) {
    this.repository = repository;
  }

  async listAll() {
    const permissions = await this.repository.listPermissions();
    return permissions.map(normalizePermission);
  }

  async listRoles() {
    return this.repository.listRoleSummaries();
  }

  async getRolePermissions(role) {
    const links = await this.repository.getRolePermissionLinks(role);
    return links.map(normalizePermissionLink);
  }

  async getUserPermissions(userId) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const [overrides, rolePermissions] = await Promise.all([
      this.repository.getUserPermissionLinks(userId),
      this.repository.getRolePermissionLinks(user.role)
    ]);

    return {
      overrides: overrides.map(normalizePermissionLink),
      rolePermissions: rolePermissions.map(normalizePermissionLink)
    };
  }

  async syncRolePermissions(role, permissionIds) {
    await this.assertValidPermissionIds(permissionIds);
    await this.repository.syncRolePermissions(role, permissionIds);
  }

  async syncUserPermissions(userId, permissionIds) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    await this.assertValidPermissionIds(permissionIds);
    await this.repository.syncUserPermissions(userId, permissionIds);
  }

  async assertValidPermissionIds(permissionIds) {
    if (permissionIds.length === 0) {
      return;
    }

    const permissions = await this.repository.listPermissionsByIds(permissionIds);
    const foundIds = new Set(permissions.map((permission) => Number(permission.id)));
    const missing = permissionIds.filter((permissionId) => !foundIds.has(Number(permissionId)));

    if (missing.length > 0) {
      throw new AppError("Some permissions do not exist", 422, {
        permissionIds: missing
      });
    }
  }
}
