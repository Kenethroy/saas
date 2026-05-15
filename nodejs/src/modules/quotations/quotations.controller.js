import { QuotationsService } from "#modules/quotations/quotations.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class QuotationsController {
  constructor(service = new QuotationsService()) {
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
      const result = await this.service.list(this.getTenantId(req), req.query, {
        branchId: this.getBranchId(req)
      });
      res.status(200).json(
        successResponse({
          message: "Quotations retrieved successfully",
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
      const quotation = await this.service.getById(this.getTenantId(req), req.params.id);
      res.status(200).json(
        successResponse({
          message: "Quotation retrieved successfully",
          data: quotation
        })
      );
    } catch (error) {
      next(error);
    }
  };

  pdf = async (req, res, next) => {
    try {
      const { buffer, fileName } = await this.service.createPdfDocument(this.getTenantId(req), req.params.id);
      const pdfBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

      return res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const quotation = await this.service.create(this.getTenantId(req), req.body, {
        branchId: this.getBranchId(req),
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(
        successResponse({
          message: "Quotation created successfully",
          data: quotation
        })
      );
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const quotation = await this.service.update(this.getTenantId(req), req.params.id, req.body, {
        branchId: this.getBranchId(req),
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Quotation updated successfully",
          data: quotation
        })
      );
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.service.delete(this.getTenantId(req), req.params.id);
      res.status(200).json(
        successResponse({
          message: "Quotation deleted successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req, res, next) => {
    try {
      const quotation = await this.service.updateStatus(this.getTenantId(req), req.params.id, req.body.status, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Quotation status updated successfully",
          data: quotation
        })
      );
    } catch (error) {
      next(error);
    }
  };

  send = async (req, res, next) => {
    try {
      const quotation = await this.service.send(this.getTenantId(req), req.params.id, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Quotation sent successfully",
          data: quotation
        })
      );
    } catch (error) {
      next(error);
    }
  };

  convert = async (req, res, next) => {
    try {
      const result = await this.service.convertToSalesOrder(this.getTenantId(req), req.params.id, {
        branchId: this.getBranchId(req),
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Quotation converted to sales order successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
