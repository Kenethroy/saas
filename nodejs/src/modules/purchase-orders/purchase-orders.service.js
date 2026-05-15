import { purchaseOrdersRepository } from "#modules/purchase-orders/purchase-orders.repository";
import { createPurchaseOrderPdf } from "#modules/purchase-orders/purchase-order-pdf";
import { AppError } from "#shared/utils/app-error";
import { allocateDocumentNumber } from "#shared/utils/document-sequences";

export const purchaseOrdersService = {
  async getAllPurchaseOrders(tenantId, filters) {
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const {
      page = 1,
      perPage,
      limit = perPage ?? 10,
      search,
      status,
      supplierId,
      branchId = null
    } = filters;
    const { items, total } = await purchaseOrdersRepository.findPaginated(tenantId, {
      page,
      limit,
      search,
      status,
      supplierId,
      branchId
    });

    return {
      data: items.map(item => ({
        ...item,
        supplierName: item.supplier?.name || null,
        paymentTermsName: item.paymentTerm?.name || null
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  async getPurchaseOrderById(tenantId, id) {
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const po = await purchaseOrdersRepository.findById(tenantId, id);
    if (!po) throw new AppError("Purchase Order not found", 404);
    return po;
  },

  async createPdfDocument(tenantId, id) {
    const purchaseOrder = await this.getPurchaseOrderById(tenantId, id);
    const buffer = await createPurchaseOrderPdf(purchaseOrder);

    return {
      fileName: `${purchaseOrder.poNumber || `purchase-order-${id}`}.pdf`,
      buffer
    };
  },

  async createPurchaseOrder(data, context) {
    const tenantId = context?.tenantId;
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const branchId = context?.branchId ?? null;
    const { clientIp } = context;
    const supplier = await purchaseOrdersRepository.findSupplierById(tenantId, data.supplierId);
    if (!supplier) throw new AppError("Supplier not found or inactive", 404);

    const variantIds = data.items.map(item => item.productVariantId);
    const variants = await purchaseOrdersRepository.findProductVariantsByIds(tenantId, variantIds);
    if (variants.length !== variantIds.length) {
      throw new AppError("One or more product variants not found or inactive", 400);
    }

    const poNumber = await allocateDocumentNumber({
      tenantId,
      branchId,
      documentType: "purchase_order",
      at: new Date(data.orderDate)
    });

    // Process items
    let itemsSubtotal = 0;
    const orderItems = data.items.map(item => {
      const variant = variants.find(v => v.id.toString() === item.productVariantId.toString());
      const unitCost = Number(item.unitCost ?? variant.unitCost);
      const quantity = Number(item.quantity) || 1;
      const lineTotal = unitCost * quantity;

      itemsSubtotal += lineTotal;

      return {
        productId: variant.productId,
        productVariantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        quantity,
        unitCost,
        lineTotal
      };
    });

    const poData = {
      branchId,
      poNumber,
      supplierId: data.supplierId,
      orderDate: new Date(data.orderDate),
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      paymentTermId: data.paymentTermId ? Number(data.paymentTermId) : null,
      itemsSubtotal,
      totalAmount: itemsSubtotal,
      notes: data.notes,
      createdIp: clientIp,
      updatedIp: clientIp,
      status: 'pending'
    };

    return await purchaseOrdersRepository.createWithItems(tenantId, poData, orderItems);
  },

  async updatePurchaseOrder(id, data, context) {
    const tenantId = context?.tenantId;
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const { clientIp } = context;
    const po = await purchaseOrdersRepository.findById(tenantId, id);
    if (!po) throw new AppError("Purchase Order not found", 404);
    if (po.status !== "pending") throw new AppError(`Cannot update purchase order with status ${po.status}`, 400);

    const supplier = await purchaseOrdersRepository.findSupplierById(tenantId, data.supplierId);
    if (!supplier) throw new AppError("Supplier not found or inactive", 404);

    const variantIds = data.items.map(item => item.productVariantId);
    const variants = await purchaseOrdersRepository.findProductVariantsByIds(tenantId, variantIds);
    if (variants.length !== variantIds.length) {
      throw new AppError("One or more product variants not found or inactive", 400);
    }

    // Process items
    let itemsSubtotal = 0;
    const orderItems = data.items.map(item => {
      const variant = variants.find(v => v.id.toString() === item.productVariantId.toString());
      const unitCost = Number(item.unitCost ?? variant.unitCost);
      const quantity = Number(item.quantity) || 1;
      const lineTotal = unitCost * quantity;

      itemsSubtotal += lineTotal;

      return {
        productId: variant.productId,
        productVariantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        quantity,
        unitCost,
        lineTotal
      };
    });

    const updateData = {
      supplierId: data.supplierId,
      orderDate: new Date(data.orderDate),
      expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
      paymentTermId: data.paymentTermId ? Number(data.paymentTermId) : null,
      itemsSubtotal,
      totalAmount: itemsSubtotal,
      notes: data.notes,
      updatedIp: clientIp
    };

    return await purchaseOrdersRepository.updateWithItems(tenantId, id, updateData, orderItems);
  },

  async updatePurchaseOrderStatus(id, status, context) {
    const tenantId = context?.tenantId;
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const { clientIp } = context;
    const po = await purchaseOrdersRepository.findById(tenantId, id);
    if (!po) throw new AppError("Purchase Order not found", 404);

    if (po.status === status) return po;

    return await purchaseOrdersRepository.updateStatus(tenantId, id, status, clientIp);
  },

  async receivePurchaseOrder(id, grnPayload, context) {
    const tenantId = context?.tenantId;
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const { clientIp, userId } = context;
    const po = await purchaseOrdersRepository.findById(tenantId, id);
    if (!po) throw new AppError("Purchase Order not found", 404);

    if (po.status !== "approved") {
      throw new AppError("Purchase order must be approved before it can be received", 400);
    }

    return purchaseOrdersRepository.receivePurchaseOrder(tenantId, id, po, grnPayload, context);
  },

  async deletePurchaseOrder(id, context) {
    const tenantId = context?.tenantId;
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const { clientIp } = context;
    const po = await purchaseOrdersRepository.findById(tenantId, id);
    if (!po) throw new AppError("Purchase Order not found", 404);

    if (po.status === "received" || po.status === "approved") {
      throw new AppError(`Cannot delete purchase order with status ${po.status}`, 400);
    }

    await purchaseOrdersRepository.softDelete(tenantId, id, clientIp);
    return { success: true, message: "Purchase order deleted successfully" };
  }
};
