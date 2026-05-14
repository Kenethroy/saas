import { successResponse } from "#shared/utils/response";
import { CustomersService } from "#modules/customers/customers.service";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class CustomersController {
  constructor(service = new CustomersService()) {
    this.service = service;
  }

  getTenantId(req) {
    return req.auth?.user?.tenantId ?? null;
  }

  list = async (req, res, next) => {
    try {
      const result = await this.service.list(this.getTenantId(req), req.query);
      res.status(200).json(
        successResponse({
          message: "Customers retrieved successfully",
          data: result.data,
          meta: result.meta
        })
      );
    } catch (error) {
      next(error);
    }
  };

  getDetails = async (req, res, next) => {
    try {
      const data = await this.service.getDetails(this.getTenantId(req), req.params.id);
      res.status(200).json(
        successResponse({
          message: "Customer details retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  getOrders = async (req, res, next) => {
    try {
      const data = await this.service.getOrders(this.getTenantId(req), req.params.id, req.query);
      res.status(200).json(
        successResponse({
          message: "Customer orders retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  getUnpaidOrders = async (req, res, next) => {
    try {
      const data = await this.service.getUnpaidOrders(this.getTenantId(req), req.params.id);
      res.status(200).json(
        successResponse({
          message: "Customer unpaid orders retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  getPayments = async (req, res, next) => {
    try {
      const data = await this.service.getPayments(this.getTenantId(req), req.params.id, req.query);
      res.status(200).json(
        successResponse({
          message: "Customer payments retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  getReturns = async (req, res, next) => {
    try {
      const data = await this.service.getReturns(this.getTenantId(req), req.params.id, req.query);
      res.status(200).json(
        successResponse({
          message: "Customer returns retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  statementPdf = async (req, res, next) => {
    try {
      const { document, fileName } = await this.service.createStatementPdfDocument(
        this.getTenantId(req),
        req.params.id,
        req.query
      );
      const pdfBuffer = Buffer.isBuffer(document) ? document : Buffer.from(document);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };

  getPerformanceInsight = async (req, res, next) => {
    try {
      const insight = await this.service.getPerformanceInsight(this.getTenantId(req), req.params.id);
      res.status(200).json({
        message: "Customer performance insight retrieved successfully",
        insight,
        data: {
          insight
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.service.getById(this.getTenantId(req), req.params.id);
      res.status(200).json(
        successResponse({
          message: "Customer retrieved successfully",
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
        userId: req.auth?.user?.id ?? null,
        userAgent: req.headers["user-agent"],
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(
        successResponse({
          message: "Customer created successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const data = await this.service.update(this.getTenantId(req), req.params.id, req.body, {
        userId: req.auth?.user?.id ?? null,
        userAgent: req.headers["user-agent"],
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Customer updated successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      await this.service.delete(this.getTenantId(req), req.params.id, {
        userId: req.auth?.user?.id ?? null,
        userAgent: req.headers["user-agent"],
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Customer deleted successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
