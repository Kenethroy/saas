import { CustomerReturnsService } from "#modules/customer-returns/customer-returns.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class CustomerReturnsController {
  constructor(service = new CustomerReturnsService()) {
    this.service = service;
  }

  list = async (req, res, next) => {
    try {
      const result = await this.service.getAllReturns(req.auth?.user?.tenantId, req.query, {
        branchId: req.auth?.branch?.id ?? null
      });
      res.status(200).json(successResponse({
        message: "Customer returns retrieved successfully",
        data: result
      }));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const customerReturn = await this.service.getReturnById(req.auth?.user?.tenantId, req.params.id);
      if (!customerReturn) {
        res.status(404).json({ message: "Customer return not found" });
        return;
      }
      res.status(200).json(successResponse({
        message: "Customer return retrieved successfully",
        data: customerReturn
      }));
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const customerReturn = await this.service.createReturn(req.auth?.user?.tenantId, req.body, {
        branchId: req.auth?.branch?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(successResponse({
        message: "Customer return created successfully",
        data: customerReturn
      }));
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const customerReturn = await this.service.updateReturn(req.auth?.user?.tenantId, req.params.id, req.body, {
        branchId: req.auth?.branch?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(successResponse({
        message: "Customer return updated successfully",
        data: customerReturn
      }));
    } catch (error) {
      next(error);
    }
  };

  approve = async (req, res, next) => {
    try {
      const result = await this.service.approveReturn(req.auth?.user?.tenantId, req.params.id, {
        userId: req.auth?.user?.id ?? null,
        branchId: req.auth?.branch?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(successResponse({
        message: "Customer return approved and finalized",
        data: result
      }));
    } catch (error) {
      next(error);
    }
  };

  reject = async (req, res, next) => {
    try {
      const result = await this.service.rejectReturn(req.auth?.user?.tenantId, req.params.id, req.body.reason, {
        userId: req.auth?.user?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(successResponse({
        message: "Customer return rejected",
        data: result
      }));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.service.deleteReturn(req.auth?.user?.tenantId, req.params.id);
      res.status(200).json(successResponse({
        message: "Customer return deleted successfully"
      }));
    } catch (error) {
      next(error);
    }
  };

  listInvoices = async (req, res, next) => {
    try {
      const data = await this.service.getCustomerInvoices(req.auth?.user?.tenantId, req.params.customerId, {
        branchId: req.auth?.branch?.id ?? null
      });
      res.status(200).json(successResponse({
        message: "Customer invoices retrieved successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  };
}
