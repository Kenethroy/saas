import { successResponse } from "#shared/utils/response";
import { PermissionsService } from "#modules/permissions/permissions.service";

export class PermissionsController {
  constructor(service = new PermissionsService()) {
    this.service = service;
  }

  listAll = async (_req, res, next) => {
    try {
      const permissions = await this.service.listAll();
      res.status(200).json(
        successResponse({
          message: "Permissions retrieved successfully",
          data: permissions
        })
      );
    } catch (error) {
      next(error);
    }
  };

  listRoles = async (_req, res, next) => {
    try {
      const roles = await this.service.listRoles();
      res.status(200).json(
        successResponse({
          message: "Roles retrieved successfully",
          data: roles
        })
      );
    } catch (error) {
      next(error);
    }
  };

  getUserPermissions = async (req, res, next) => {
    try {
      const data = await this.service.getUserPermissions(req.params.id);
      res.status(200).json(
        successResponse({
          message: "User permissions retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  syncUserPermissions = async (req, res, next) => {
    try {
      await this.service.syncUserPermissions(req.params.id, req.body.permissionIds);
      res.status(200).json(
        successResponse({
          message: "User permissions updated successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };

  getRolePermissions = async (req, res, next) => {
    try {
      const permissions = await this.service.getRolePermissions(req.params.role);
      res.status(200).json(
        successResponse({
          message: "Role permissions retrieved successfully",
          data: permissions
        })
      );
    } catch (error) {
      next(error);
    }
  };

  syncRolePermissions = async (req, res, next) => {
    try {
      await this.service.syncRolePermissions(req.params.role, req.body.permissionIds);
      res.status(200).json(
        successResponse({
          message: "Role permissions updated successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
