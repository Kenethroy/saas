import { successResponse } from "#shared/utils/response";
import { EmployeesService } from "#modules/employees/employees.service";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class EmployeesController {
  constructor(service = new EmployeesService()) {
    this.service = service;
  }

  list = async (req, res, next) => {
    try {
      const result = await this.service.list(req.auth?.user?.tenantId, req.query, {
        branchId: req.auth?.branch?.id ?? null
      });
      res.status(200).json(
        successResponse({
          message: "Employees retrieved successfully",
          data: result.data,
          meta: result.meta
        })
      );
    } catch (error) {
      next(error);
    }
  };

  show = async (req, res, next) => {
    try {
      const employee = await this.service.getById(req.auth?.user?.tenantId, req.params.id);
      res.status(200).json(
        successResponse({
          message: "Employee retrieved successfully",
          data: employee
        })
      );
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const result = await this.service.create(req.auth?.user?.tenantId, req.body, {
        branchId: req.auth?.branch?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(
        successResponse({
          message: "Employee registered successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const employee = await this.service.update(req.auth?.user?.tenantId, req.params.id, req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Employee updated successfully",
          data: employee
        })
      );
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.service.delete(req.auth?.user?.tenantId, req.params.id, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Employee removed successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
