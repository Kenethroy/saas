import { successResponse } from "#shared/utils/response";
import { CategoriesService } from "#modules/categories/categories.service";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class CategoriesController {
  constructor(service = new CategoriesService()) {
    this.service = service;
  }

  getTenantId(req) {
    return req.auth?.user?.tenantId ?? null;
  }

  getBranchId(req) {
    return req.auth?.branch?.id ?? null;
  }

  list = async (req, res, next) => {
    try {
      const result = await this.service.list(this.getTenantId(req), req.query);
      res.status(200).json(
        successResponse({
          message: "Categories retrieved successfully",
          data: result.data,
          meta: result.meta
        })
      );
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.service.getById(this.getTenantId(req), req.params.id);
      res.status(200).json(
        successResponse({
          message: "Category retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  listForSelection = async (req, res, next) => {
    try {
      const data = await this.service.listForSelection(this.getTenantId(req), {
        branchId: this.getBranchId(req)
      });
      res.status(200).json(
        successResponse({
          message: "Category list retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  listOptions = async (req, res, next) => {
    try {
      const data = await this.service.listOptions(this.getTenantId(req));
      res.status(200).json(
        successResponse({
          message: "Category options retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const data = await this.service.create(this.getTenantId(req), req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(
        successResponse({
          message: "Category created successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      await this.service.update(this.getTenantId(req), req.params.id, req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Category updated successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.service.delete(this.getTenantId(req), req.params.id, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Category deleted successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
