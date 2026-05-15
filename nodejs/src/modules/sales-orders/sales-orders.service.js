import { AppError } from "#shared/utils/app-error";
import { SalesOrdersRepository } from "#modules/sales-orders/sales-orders.repository";
import { createSalesInvoicePdf } from "#modules/sales-orders/sales-invoice-pdf";

function requireTenantId(tenantId) {
  const normalized = Number(tenantId);
  if (!normalized) {
    throw new AppError("Tenant context is required", 401);
  }
  return normalized;
}

const STATUS_ORDER = ["pending", "processing", "for_delivery", "delivered", "completed"];
const STOCK_ALERT_ACTIVE_STATUSES = new Set(["pending", "processing", "for_delivery"]);
const statusRank = STATUS_ORDER.reduce((acc, current, index) => {
  acc[current] = index;
  return acc;
}, {});

function assertSalesOrderStatusTransition(currentStatus, nextStatus) {
  if (!currentStatus || currentStatus === nextStatus) return;
  if (currentStatus === "cancelled" || currentStatus === "completed") {
    throw new AppError("Cannot update status for a closed sales order.", 422);
  }
  if (currentStatus === "delivered") {
    if (nextStatus !== "completed") {
      throw new AppError("Cannot revert a delivered sales order back to an earlier status.", 422);
    }
    return;
  }
  if (nextStatus === "completed") {
    throw new AppError("Cannot mark a sales order as completed before it is delivered.", 422);
  }
  if (nextStatus === "cancelled") return;

  const current = statusRank[currentStatus];
  const next = statusRank[nextStatus];
  if (!Number.isInteger(current) || !Number.isInteger(next)) {
    throw new AppError("Invalid sales order status transition.", 422);
  }
  if (next < current) {
    throw new AppError("Cannot move sales order status backward.", 422);
  }
}

function assertSalesOrderEditable(status) {
  if (!["pending", "processing"].includes(status)) {
    throw new AppError("Only pending or processing sales orders can be edited.", 422);
  }
}

function normalizeSalesOrder(record) {
  const itemCount = record._count?.items ?? record.itemCount ?? record.items?.length ?? 0;

  return {
    id: Number(record.id),
    branchId: record.branchId ? Number(record.branchId) : null,
    salesOrderNumber: record.salesOrderNumber,
    customerId: Number(record.customerId),
    orderDate: record.orderDate,
    agentId: record.agentId ? Number(record.agentId) : null,
    paymentTermId: record.paymentTermId,
    status: record.status,
    itemsSubtotal: Number(record.itemsSubtotal),
    discountType: record.discountType,
    discountValue: Number(record.discountValue),
    discountAmount: Number(record.discountAmount),
    totalAmount: Number(record.totalAmount),
    notes: record.notes,
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
    customer: record.customer
      ? {
          id: Number(record.customer.id),
          name: record.customer.name
        }
      : null,
    agent: record.agent
      ? {
          id: Number(record.agent.id),
          firstName: record.agent.firstName,
          lastName: record.agent.lastName
        }
      : null,
    paymentTerm: record.paymentTerm
      ? {
          id: record.paymentTerm.id,
          name: record.paymentTerm.name,
          days: record.paymentTerm.days
        }
      : null,
    invoice: record.invoice
      ? {
          id: Number(record.invoice.id),
          invoiceNumber: record.invoice.invoiceNumber,
          status: record.invoice.status
        }
      : null,
    itemCount,
    items: (record.items ?? []).map((item) => ({
      id: Number(item.id),
      productId: Number(item.productId),
      productVariantId: Number(item.productVariantId),
      productName: item.productName,
      variantName: item.variantName,
      availableStock: Number(item.availableStock ?? item.productVariant?.stockQuantity ?? 0),
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      unitCost: Number(item.unitCost),
      lineDiscount: Number(item.lineDiscount ?? 0),
      lineTotal: Number(item.lineTotal)
    }))
  };
}

function normalizeSalesOrderSelection(record) {
  return {
    id: Number(record.id),
    salesOrderNumber: record.salesOrderNumber,
    customerId: Number(record.customerId),
    customerName: record.customerName ?? record.customer?.name ?? "N/A",
    customerAddress: record.customerAddress ?? record.customer?.address ?? null,
    customerPhone: record.customerPhone ?? record.customer?.phone ?? null,
    customerEmail: record.customerEmail ?? record.customer?.email ?? null,
    orderDate: record.orderDate,
    totalAmount: Number(record.totalAmount),
    status: record.status
  };
}

function buildVariantQuantityMap(items = []) {
  return items.reduce((acc, item) => {
    const variantId = Number(item.productVariantId);
    acc.set(variantId, Number(acc.get(variantId) ?? 0) + Number(item.quantity ?? 0));
    return acc;
  }, new Map());
}

function buildAvailableStockErrorMessage(variant, quantity, available) {
  const productLabel = [variant?.product?.name, variant?.name].filter(Boolean).join(" ");
  return `Insufficient available stock for ${productLabel || "the selected product"}. Requested ${quantity}, available ${Math.max(0, available)} after reservations.`;
}

export class SalesOrdersService {
  constructor(repository = new SalesOrdersRepository()) {
    this.repository = repository;
  }

  async list(tenantId, filters, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const page = parseInt(filters.page) || 1;
    const perPage = parseInt(filters.perPage) || 10;
    const { rows, total } = await this.repository.findPaginated(scopedTenantId, {
      page,
      perPage,
      search: filters.search,
      status: filters.status,
      branchId: context.branchId ?? null
    });

    return {
      data: await this._decorateOrdersWithStockCoverage(scopedTenantId, rows.map(normalizeSalesOrder)),
      meta: {
        currentPage: page,
        perPage,
        total,
        lastPage: Math.ceil(total / perPage) || 1
      }
    };
  }

  async getById(tenantId, id) {
    const scopedTenantId = requireTenantId(tenantId);
    const salesOrder = await this.repository.findById(scopedTenantId, id);
    if (!salesOrder) throw new AppError("Sales order not found", 404);
    return this._decorateOrderWithStockCoverage(scopedTenantId, normalizeSalesOrder(salesOrder));
  }

  async listForDeliverySelection(tenantId, context = {}) {
    const rows = await this.repository.findForDeliverySelection(requireTenantId(tenantId), {
      branchId: context.branchId ?? null
    });
    return rows.map(normalizeSalesOrderSelection);
  }

  async create(tenantId, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const branchId = context.branchId ? Number(context.branchId) : null;
    const customer = await this.repository.findCustomerById(scopedTenantId, payload.customerId);
    if (!customer) throw new AppError("Customer not found", 404);

    if (payload.agentId) {
      const agent = await this.repository.findAgentById(scopedTenantId, payload.agentId);
      if (!agent) throw new AppError("Agent not found", 404);
    }

    if (payload.paymentTermId) {
      const paymentTerm = await this.repository.findPaymentTermById(scopedTenantId, payload.paymentTermId);
      if (!paymentTerm) throw new AppError("Payment term not found", 404);
    }

    const normalizedItems = await this._resolveSalesOrderItems(scopedTenantId, payload.items, { branchId });
    const itemsSubtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    let discountAmount = 0;

    if (payload.discountType === "percentage") {
      discountAmount = itemsSubtotal * (Number(payload.discountValue ?? 0) / 100);
    } else if (payload.discountType === "fixed") {
      discountAmount = Number(payload.discountValue ?? 0);
    }

    if (discountAmount > itemsSubtotal) discountAmount = itemsSubtotal;
    const totalAmount = itemsSubtotal - discountAmount;

    const ipAddress = context.ipAddress ?? null;

    const created = await this.repository.createWithItems({
      tenantId: scopedTenantId,
      branchId,
      customerId: payload.customerId,
      orderDate: new Date(payload.orderDate),
      agentId: payload.agentId || null,
      paymentTermId: payload.paymentTermId ?? customer.payment_term_id ?? null,
      status: "pending",
      itemsSubtotal,
      discountType: payload.discountType,
      discountValue: payload.discountValue ?? 0,
      discountAmount,
      totalAmount,
      notes: payload.notes ?? null,
      createdIp: ipAddress,
      updatedIp: ipAddress
    }, normalizedItems);
    
    return this._decorateOrderWithStockCoverage(scopedTenantId, normalizeSalesOrder(created));
  }

  async update(tenantId, id, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) throw new AppError("Sales order not found", 404);

    assertSalesOrderEditable(existing.status);

    const customer = await this.repository.findCustomerById(scopedTenantId, payload.customerId);
    if (!customer) throw new AppError("Customer not found", 404);

    if (payload.agentId) {
      const agent = await this.repository.findAgentById(scopedTenantId, payload.agentId);
      if (!agent) throw new AppError("Agent not found", 404);
    }

    if (payload.paymentTermId) {
      const paymentTerm = await this.repository.findPaymentTermById(scopedTenantId, payload.paymentTermId);
      if (!paymentTerm) throw new AppError("Payment term not found", 404);
    }

    const normalizedItems = await this._resolveSalesOrderItems(scopedTenantId, payload.items, {
      branchId: existing.branchId ?? null,
      enforceAvailableStock: existing.status === "processing",
      excludeSalesOrderId: existing.status === "processing" ? Number(id) : undefined
    });
    const itemsSubtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    let discountAmount = 0;

    if (payload.discountType === "percentage") {
      discountAmount = itemsSubtotal * (Number(payload.discountValue ?? 0) / 100);
    } else if (payload.discountType === "fixed") {
      discountAmount = Number(payload.discountValue ?? 0);
    }

    if (discountAmount > itemsSubtotal) discountAmount = itemsSubtotal;
    const totalAmount = itemsSubtotal - discountAmount;
    const ipAddress = context.ipAddress ?? null;

    const rawUpdated = await this.repository.updateWithItems(scopedTenantId, id, {
      customerId: payload.customerId,
      agentId: payload.agentId || null,
      orderDate: new Date(payload.orderDate),
      paymentTermId: payload.paymentTermId || customer.payment_term_id || null,
      itemsSubtotal,
      discountType: payload.discountType,
      discountValue: payload.discountValue || 0,
      discountAmount,
      totalAmount,
      notes: payload.notes || null,
      updatedIp: ipAddress
    }, normalizedItems);

    return this._decorateOrderWithStockCoverage(scopedTenantId, normalizeSalesOrder(rawUpdated));
  }

  async updateStatus(tenantId, id, status, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) throw new AppError("Sales order not found", 404);
    if (existing.status === status) {
      return this._decorateOrderWithStockCoverage(scopedTenantId, normalizeSalesOrder(existing));
    }

    if (status === "for_delivery") {
      throw new AppError("Use the Delivery module to move a sales order into For Delivery.", 422);
    }

    const ipAddress = context.ipAddress ?? null;
    const userId = context.userId ?? null;

    assertSalesOrderStatusTransition(existing.status, status);

    if (status === "processing") {
      await this._resolveSalesOrderItems(
        scopedTenantId,
        (existing.items ?? []).map((item) => ({
          productVariantId: Number(item.productVariantId),
          quantity: Number(item.quantity)
        })),
        {
          branchId: existing.branchId ?? null,
          enforceAvailableStock: true
        }
      );
    }

    if (status === "delivered") {
      const delivered = await this.repository.deliverAndUpdateStatus(scopedTenantId, id, { ipAddress, userId });
      return this._decorateOrderWithStockCoverage(scopedTenantId, normalizeSalesOrder(delivered));
    }

    const updated = await this.repository.updateStatus(scopedTenantId, id, status, ipAddress);
    return this._decorateOrderWithStockCoverage(scopedTenantId, normalizeSalesOrder(updated));
  }

  async _resolveSalesOrderItems(tenantId, items, options = {}) {
    const variantIds = items.map((item) => item.productVariantId);
    const variants = await this.repository.findProductVariantsByIds(tenantId, variantIds, {
      branchId: options.branchId ?? null
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const reservedByVariantId = options.enforceAvailableStock
      ? new Map(
          (
            await this.repository.sumReservedQuantitiesByVariantIds(tenantId, variantIds, {
              branchId: options.branchId ?? null,
              excludeSalesOrderId: options.excludeSalesOrderId
            })
          ).map((entry) => [Number(entry.productVariantId), Number(entry._sum.quantity ?? 0)])
        )
      : new Map();

    return items.map((item) => {
      const variant = variantMap.get(item.productVariantId);
      if (!variant) throw new AppError(`Product variant ${item.productVariantId} not found`, 404);
      if (variant.stockQuantity < item.quantity) throw new AppError(`Insufficient stock for ${variant.name}`, 422);

      if (options.enforceAvailableStock) {
        const available = Number(variant.stockQuantity ?? 0) - Number(reservedByVariantId.get(Number(variant.id)) ?? 0);
        if (available < Number(item.quantity ?? 0)) {
          throw new AppError(buildAvailableStockErrorMessage(variant, Number(item.quantity ?? 0), available), 422);
        }
      }

      const unitPrice = Number(variant.unitPrice);
      const unitCost = Number(variant.unitCost ?? 0);
      const lineSubtotal = unitPrice * item.quantity;
      const discountPercent = Math.max(0, Math.min(100, Number(item.discountPercent ?? 0)));
      const lineDiscount = discountPercent > 0 ? lineSubtotal * (discountPercent / 100) : 0;
      const lineTotal = Math.max(0, lineSubtotal - Math.min(lineSubtotal, lineDiscount));

      return {
        productId: variant.productId,
        productVariantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        quantity: item.quantity,
        unitPrice,
        unitCost,
        lineDiscount,
        lineTotal
      };
    });
  }

  async _decorateOrderWithStockCoverage(tenantId, order) {
    const [decoratedOrder] = await this._decorateOrdersWithStockCoverage(tenantId, order ? [order] : []);
    return decoratedOrder ?? order;
  }

  async _decorateOrdersWithStockCoverage(tenantId, orders = []) {
    if (!orders.length) {
      return [];
    }

    const variantIds = [...new Set(orders.flatMap((order) => (order.items ?? []).map((item) => Number(item.productVariantId))))];
    if (!variantIds.length) {
      return orders.map((order) => ({
        ...order,
        hasStockShortage: false,
        stockShortageCount: 0,
        stockShortages: []
      }));
    }

    const reservedByBranchVariantKey = new Map();
    const variantIdsByBranchKey = orders.reduce((acc, order) => {
      const branchKey = order.branchId ? Number(order.branchId) : 0;
      if (!acc.has(branchKey)) {
        acc.set(branchKey, new Set());
      }

      for (const item of order.items ?? []) {
        acc.get(branchKey).add(Number(item.productVariantId));
      }

      return acc;
    }, new Map());

    for (const [branchKey, variantIdSet] of variantIdsByBranchKey.entries()) {
      const scopedVariantIds = [...variantIdSet];
      if (!scopedVariantIds.length) {
        continue;
      }

      const reservedQuantities = await this.repository.sumReservedQuantitiesByVariantIds(tenantId, scopedVariantIds, {
        branchId: branchKey || null
      });

      for (const entry of reservedQuantities) {
        reservedByBranchVariantKey.set(
          `${branchKey}:${Number(entry.productVariantId)}`,
          Number(entry._sum.quantity ?? 0)
        );
      }
    }

    return orders.map((order) => {
      const stockAlertActive = STOCK_ALERT_ACTIVE_STATUSES.has(order.status);
      const ownReservedByVariantId = order.status === "processing" ? buildVariantQuantityMap(order.items) : new Map();
      const branchKey = order.branchId ? Number(order.branchId) : 0;
      const items = (order.items ?? []).map((item) => {
        const variantId = Number(item.productVariantId);
        const onHand = Number(item.onHandStock ?? item.availableStock ?? item.productVariant?.stockQuantity ?? 0);
        const totalReserved = Number(reservedByBranchVariantKey.get(`${branchKey}:${variantId}`) ?? 0);
        const ownReserved = Number(ownReservedByVariantId.get(variantId) ?? 0);
        const reserved = Math.max(0, totalReserved - ownReserved);
        const available = onHand - reserved;

        return {
          ...item,
          onHandStock: onHand,
          reservedStock: reserved,
          availableStock: available
        };
      });

      const stockShortages = items
        .filter((item) => Number(item.quantity ?? 0) > Number(item.availableStock ?? 0))
        .map((item) => ({
          productVariantId: Number(item.productVariantId),
          productName: item.productName,
          variantName: item.variantName,
          quantity: Number(item.quantity ?? 0),
          availableStock: Number(item.availableStock ?? 0),
          onHandStock: Number(item.onHandStock ?? 0),
          reservedStock: Number(item.reservedStock ?? 0)
        }));

      return {
        ...order,
        items,
        hasStockShortage: stockAlertActive && stockShortages.length > 0,
        stockShortageCount: stockAlertActive ? stockShortages.length : 0,
        stockShortages: stockAlertActive ? stockShortages : []
      };
    });
  }

  async createInvoicePdfDocument(tenantId, salesOrderId) {
    const invoice = await this.repository.findInvoiceForPdf(requireTenantId(tenantId), salesOrderId);
    if (!invoice) {
      throw new AppError("Invoice not found for this sales order.", 404);
    }

    const document = await createSalesInvoicePdf(invoice);
    return {
      invoiceNumber: invoice.invoiceNumber,
      document
    };
  }
}
