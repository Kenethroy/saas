import { successResponse } from "#shared/utils/response";
import { UsersService } from "#modules/users/users.service";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class UsersController {
  constructor(service = new UsersService()) {
    this.service = service;
  }

  list = async (req, res, next) => {
    try {
      const result = await this.service.list(req.query);
      res.status(200).json(
        successResponse({
          message: "Users retrieved successfully",
          data: result.data,
          meta: result.meta
        })
      );
    } catch (error) {
      next(error);
    }
  };

  employeeOptions = async (req, res, next) => {
    try {
      const employees = await this.service.listAvailableEmployees(req.query.search);
      res.status(200).json(
        successResponse({
          message: "Available employees retrieved successfully",
          data: employees
        })
      );
    } catch (error) {
      next(error);
    }
  };

  show = async (req, res, next) => {
    try {
      const user = await this.service.getById(req.params.id);
      res.status(200).json(
        successResponse({
          message: "User retrieved successfully",
          data: user
        })
      );
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const user = await this.service.create(req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(
        successResponse({
          message: "User access granted successfully",
          data: user
        })
      );
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const user = await this.service.update(req.params.id, req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "User updated successfully",
          data: user
        })
      );
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.service.delete(req.params.id, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "User removed successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
