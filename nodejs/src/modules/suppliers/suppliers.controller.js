import { suppliersService } from "#modules/suppliers/suppliers.service";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export const suppliersController = {
  getTenantId(req) {
    return req.auth?.user?.tenantId ?? null;
  },

  async getSuppliers(req, res, next) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const search = req.query.search || "";
      const status = req.query.status;

      const result = await suppliersService.getAllSuppliers({
        tenantId: this.getTenantId(req),
        page,
        limit,
        search,
        status
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async getSupplier(req, res, next) {
    try {
      const { id } = req.params;
      const supplier = await suppliersService.getSupplierById(this.getTenantId(req), id);
      res.json(supplier);
    } catch (error) {
      next(error);
    }
  },

  async getSupplierDetails(req, res, next) {
    try {
      const { id } = req.params;
      const supplierDetails = await suppliersService.getSupplierDetails(this.getTenantId(req), id);
      res.json(supplierDetails);
    } catch (error) {
      next(error);
    }
  },

  async createSupplier(req, res, next) {
    try {
      const clientIp = getPersistedRequestIp(req);
      const newSupplier = await suppliersService.createSupplier(this.getTenantId(req), req.body, clientIp);
      res.status(201).json(newSupplier);
    } catch (error) {
      next(error);
    }
  },

  async updateSupplier(req, res, next) {
    try {
      const { id } = req.params;
      const clientIp = getPersistedRequestIp(req);
      const updatedSupplier = await suppliersService.updateSupplier(this.getTenantId(req), id, req.body, clientIp);
      res.json(updatedSupplier);
    } catch (error) {
      next(error);
    }
  },

  async updateSupplierStatus(req, res, next) {
    try {
      const { id } = req.params;
      const clientIp = getPersistedRequestIp(req);
      const updatedSupplier = await suppliersService.updateSupplierStatus(this.getTenantId(req), id, req.body.status, clientIp);
      res.json(updatedSupplier);
    } catch (error) {
      next(error);
    }
  },

  async deleteSupplier(req, res, next) {
    try {
      const { id } = req.params;
      const clientIp = getPersistedRequestIp(req);
      const result = await suppliersService.deleteSupplier(this.getTenantId(req), id, clientIp);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
};
