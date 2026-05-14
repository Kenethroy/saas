import { successResponse } from "#shared/utils/response";
import { ProductsService } from "#modules/products/products.service";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class ProductsController {
  constructor(service = new ProductsService()) {
    this.service = service;
  }

  getTenantId(req) {
    return req.auth?.user?.tenantId ?? null;
  }

  brochurePdf = async (req, res, next) => {
    try {
      const { document, fileName } = await this.service.createBrochurePdfDocument(this.getTenantId(req));
      const pdfBuffer = Buffer.isBuffer(document) ? document : Buffer.from(document);
      
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      
      return res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };

  list = async (req, res, next) => {
    try {
      const result = await this.service.list(this.getTenantId(req), req.query);
      res.status(200).json(
        successResponse({
          message: "Products retrieved successfully",
          data: result.data,
          meta: result.meta
        })
      );
    } catch (error) {
      next(error);
    }
  };

  inventoryOverview = async (req, res, next) => {
    try {
      const result = await this.service.listInventoryOverview(this.getTenantId(req), req.query);
      res.status(200).json(
        successResponse({
          message: "Inventory overview retrieved successfully",
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
          message: "Product retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  listForSalesOrder = async (req, res, next) => {
    try {
      const data = await this.service.listForSalesOrder(this.getTenantId(req), req.query);
      res.status(200).json(
        successResponse({
          message: "Product variants retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  uploadImage = async (req, res, next) => {
    try {
      const data = await this.service.uploadImage(req.file);
      res.status(200).json(
        successResponse({
          message: "Product image uploaded successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  deleteUploadedImage = async (req, res, next) => {
    try {
      await this.service.deleteUploadedImage(this.getTenantId(req), req.body.fileUrl);
      res.status(200).json(
        successResponse({
          message: "Uploaded product image deleted successfully"
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
          message: "Product created successfully",
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
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Product updated successfully",
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
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Product deleted successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };

  createVariant = async (req, res, next) => {
    try {
      const data = await this.service.createVariant(this.getTenantId(req), req.params.id, req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(
        successResponse({
          message: "Product variant created successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  updateVariant = async (req, res, next) => {
    try {
      const data = await this.service.updateVariant(this.getTenantId(req), req.params.variantId, req.body, {
        userId: req.auth?.user?.id ?? null,
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Product variant updated successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  deleteVariant = async (req, res, next) => {
    try {
      await this.service.deleteVariant(this.getTenantId(req), req.params.variantId, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(200).json(
        successResponse({
          message: "Product variant deleted successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
