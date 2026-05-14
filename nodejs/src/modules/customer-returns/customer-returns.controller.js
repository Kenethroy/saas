import { CustomerReturnsService } from "#modules/customer-returns/customer-returns.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class CustomerReturnsController {
  constructor(service = new CustomerReturnsService()) {
    this.service = service;
  }

  list = async (req, res, next) => {
    try {
      const result = await this.service.getAllReturns(req.query);
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
      const customerReturn = await this.service.getReturnById(req.params.id);
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
      const customerReturn = await this.service.createReturn(req.body, {
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
      const customerReturn = await this.service.updateReturn(req.params.id, req.body, {
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
      const result = await this.service.approveReturn(req.params.id, {
        userId: req.auth?.user?.id ?? null,
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
      const result = await this.service.rejectReturn(req.params.id, req.body.reason, {
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
      await this.service.deleteReturn(req.params.id);
      res.status(200).json(successResponse({
        message: "Customer return deleted successfully"
      }));
    } catch (error) {
      next(error);
    }
  };

  listInvoices = async (req, res, next) => {
    try {
      const data = await this.service.getCustomerInvoices(req.params.customerId);
      res.status(200).json(successResponse({
        message: "Customer invoices retrieved successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  };
}
