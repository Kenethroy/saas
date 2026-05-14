import { DeliveriesService } from "#modules/deliveries/deliveries.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class DeliveriesController {
  constructor(service = new DeliveriesService()) {
    this.service = service;
  }

  getTenantId(req) {
    return req.auth?.user?.tenantId ?? null;
  }

  list = async (req, res, next) => {
    try {
      const result = await this.service.list(this.getTenantId(req), req.query);
      res.status(200).json(successResponse({
        message: "Deliveries retrieved successfully",
        data: result.data,
        meta: result.meta
      }));
    } catch (error) {
      next(error);
    }
  };

  selectionOptions = async (req, res, next) => {
    try {
      const data = await this.service.getSelectionOptions(this.getTenantId(req));
      res.status(200).json(successResponse({
        message: "Delivery selection data retrieved successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.service.getById(this.getTenantId(req), req.params.id);
      res.status(200).json(successResponse({
        message: "Delivery retrieved successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const data = await this.service.create(this.getTenantId(req), req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(successResponse({
        message: "Delivery created successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const data = await this.service.update(this.getTenantId(req), req.params.id, req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(successResponse({
        message: "Delivery updated successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req, res, next) => {
    try {
      const data = await this.service.updateStatus(this.getTenantId(req), req.params.id, req.body, {
        userId: req.auth?.user?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(successResponse({
        message: "Delivery status updated successfully",
        data
      }));
    } catch (error) {
      next(error);
    }
  };

  receiptPdf = async (req, res, next) => {
    try {
      const { buffer, fileName } = await this.service.createReceiptPdfDocument(this.getTenantId(req), req.params.id);
      const pdfBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
      
      return res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };
}
