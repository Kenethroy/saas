import { purchaseOrdersService } from "#modules/purchase-orders/purchase-orders.service";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export const purchaseOrdersController = {
  async pdf(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId;
      const { buffer, fileName } = await purchaseOrdersService.createPdfDocument(tenantId, req.params.id);
      const pdfBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

      return res.send(pdfBuffer);
    } catch (error) {
      next(error);
    }
  },

  async getPurchaseOrders(req, res, next) {
    try {
      const tenantId = req.auth?.user?.tenantId;
      const page = parseInt(req.query.page, 10) || 1;
      const perPage = parseInt(req.query.perPage, 10) || 10;
      const search = req.query.search || "";
      const status = req.query.status;
      const supplierId = req.query.supplierId ? parseInt(req.query.supplierId, 10) : undefined;

      const result = await purchaseOrdersService.getAllPurchaseOrders(tenantId, {
        page,
        perPage,
        search,
        status,
        supplierId,
        branchId: req.auth?.branch?.id ?? null
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async getPurchaseOrder(req, res, next) {
    try {
      const { id } = req.params;
      const tenantId = req.auth?.user?.tenantId;
      const po = await purchaseOrdersService.getPurchaseOrderById(tenantId, id);
      res.json(po);
    } catch (error) {
      next(error);
    }
  },

  async createPurchaseOrder(req, res, next) {
    try {
      const clientIp = getPersistedRequestIp(req);
      const context = { tenantId: req.auth?.user?.tenantId, branchId: req.auth?.branch?.id ?? null, userId: req.auth?.user?.id, clientIp };
      const newPo = await purchaseOrdersService.createPurchaseOrder(req.body, context);
      res.status(201).json(newPo);
    } catch (error) {
      next(error);
    }
  },

  async updatePurchaseOrder(req, res, next) {
    try {
      const { id } = req.params;
      const clientIp = getPersistedRequestIp(req);
      const context = { tenantId: req.auth?.user?.tenantId, branchId: req.auth?.branch?.id ?? null, userId: req.auth?.user?.id, clientIp };
      const updatedPo = await purchaseOrdersService.updatePurchaseOrder(id, req.body, context);
      res.json(updatedPo);
    } catch (error) {
      next(error);
    }
  },

  async updatePurchaseOrderStatus(req, res, next) {
    try {
      const { id } = req.params;
      const clientIp = getPersistedRequestIp(req);
      const context = { tenantId: req.auth?.user?.tenantId, branchId: req.auth?.branch?.id ?? null, userId: req.auth?.user?.id, clientIp };
      const updatedPo = await purchaseOrdersService.updatePurchaseOrderStatus(id, req.body.status, context);
      res.json(updatedPo);
    } catch (error) {
      next(error);
    }
  },

  async receivePurchaseOrder(req, res, next) {
    try {
      const { id } = req.params;
      const clientIp = getPersistedRequestIp(req);
      const context = { tenantId: req.auth?.user?.tenantId, branchId: req.auth?.branch?.id ?? null, userId: req.auth?.user?.id, clientIp };
      const updatedPo = await purchaseOrdersService.receivePurchaseOrder(id, req.body, context);
      res.json(updatedPo);
    } catch (error) {
      next(error);
    }
  },

  async deletePurchaseOrder(req, res, next) {
    try {
      const { id } = req.params;
      const clientIp = getPersistedRequestIp(req);
      const context = { tenantId: req.auth?.user?.tenantId, branchId: req.auth?.branch?.id ?? null, userId: req.auth?.user?.id, clientIp };
      const result = await purchaseOrdersService.deletePurchaseOrder(id, context);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
};
