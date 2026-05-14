import { successResponse } from "#shared/utils/response";
import { SalesOrdersService } from "#modules/sales-orders/sales-orders.service";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class SalesOrdersController {
  constructor(service = new SalesOrdersService()) {
    this.service = service;
  }

  getTenantId(req) {
    return req.auth?.user?.tenantId ?? null;
  }

  invoicePdf = async (req, res, next) => {
    try {
      const { document, invoiceNumber } = await this.service.createInvoicePdfDocument(this.getTenantId(req), req.params.id);
      const pdfBuffer = Buffer.isBuffer(document) ? document : Buffer.from(document);
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${invoiceNumber}.pdf"`);
      
      return res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const salesOrder = await this.service.getById(this.getTenantId(req), req.params.id);
      res.status(200).json(
        successResponse({
          message: "Sales order retrieved successfully",
          data: salesOrder
        })
      );
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const salesOrder = await this.service.update(this.getTenantId(req), req.params.id, req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Sales order updated successfully",
          data: salesOrder
        })
      );
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req, res, next) => {
    try {
      const salesOrder = await this.service.updateStatus(this.getTenantId(req), req.params.id, req.body.status, {
        userId: req.auth?.user?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Sales order status updated successfully",
          data: salesOrder
        })
      );
    } catch (error) {
      next(error);
    }
  };

  list = async (req, res, next) => {
    try {
      const salesOrders = await this.service.list(this.getTenantId(req), req.query);
      res.status(200).json(
        successResponse({
          message: "Sales orders retrieved successfully",
          data: salesOrders.data,
          meta: salesOrders.meta
        })
      );
    } catch (error) {
      next(error);
    }
  };

  listForDeliverySelection = async (req, res, next) => {
    try {
      const data = await this.service.listForDeliverySelection(this.getTenantId(req));
      res.status(200).json(
        successResponse({
          message: "Sales orders for delivery retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const salesOrder = await this.service.create(this.getTenantId(req), req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(
        successResponse({
          message: "Sales order created successfully",
          data: salesOrder
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
