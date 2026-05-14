import { AppError } from "#shared/utils/app-error";
import { DeliveriesRepository } from "#modules/deliveries/deliveries.repository";

function requireTenantId(tenantId) {
  const normalized = Number(tenantId);
  if (!normalized) {
    throw new AppError("Tenant context is required", 401);
  }
  return normalized;
}

function formatDeliveryNumber(id) {
  return `DEL-${String(id).padStart(6, "0")}`;
}

function toName(record) {
  if (!record) return null;
  return [record.firstName, record.lastName].filter(Boolean).join(" ").trim();
}

function assertEditableStatus(status) {
  if (status !== "pending") throw new AppError("Only pending deliveries can be edited.", 422);
}

function assertStatusTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return;
  const transitions = {
    pending: new Set(["in_transit", "cancelled"]),
    in_transit: new Set(["delivered", "cancelled"]),
    delivered: new Set([]),
    cancelled: new Set([])
  };
  if (!transitions[currentStatus]?.has(nextStatus)) throw new AppError("Invalid delivery status transition.", 422);
}

export class DeliveriesService {
  constructor(repository = new DeliveriesRepository()) {
    this.repository = repository;
  }

  async list(tenantId, filters) {
    const scopedTenantId = requireTenantId(tenantId);
    const page = parseInt(filters.page) || 1;
    const perPage = parseInt(filters.perPage) || 10;
    const { rows, total } = await this.repository.findPaginated(scopedTenantId, {
      ...filters,
      page,
      perPage
    });

    return {
      data: rows.map(row => ({
        ...row,
        driverName: toName(row.driver),
        totalOrders: row.salesOrders?.length || 0,
        totalAmount: (row.salesOrders || []).reduce((sum, so) => sum + Number(so.salesOrder?.totalAmount || 0), 0)
      })),
      meta: {
        currentPage: page,
        perPage,
        total,
        lastPage: Math.ceil(total / perPage) || 1
      }
    };
  }

  async getById(tenantId, id) {
    const delivery = await this.repository.findById(requireTenantId(tenantId), id);
    if (!delivery) throw new AppError("Delivery not found", 404);
    return {
      ...delivery,
      driverName: toName(delivery.driver),
      totalOrders: delivery.salesOrders?.length || 0,
      totalAmount: (delivery.salesOrders || []).reduce((sum, so) => sum + Number(so.salesOrder?.totalAmount || 0), 0)
    };
  }

  async getSelectionOptions(tenantId) {
    const scopedTenantId = requireTenantId(tenantId);
    const [salesOrders, drivers, trucks] = await Promise.all([
      this.repository.findSalesOrdersForSelection(scopedTenantId),
      this.repository.findActiveEmployees(scopedTenantId, { position: "driver" }),
      this.repository.findTrucksForAssignment(scopedTenantId)
    ]);

    return {
      salesOrders,
      drivers: drivers.map(d => ({ ...d, name: `${d.firstName} ${d.lastName}`.trim() })),
      trucks
    };
  }

  async create(tenantId, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const ipAddress = context.ipAddress ?? null;
    const latest = await this.repository.findLatestDelivery(scopedTenantId);
    const nextId = (latest?.id || 0) + 1;
    const deliveryNumber = formatDeliveryNumber(nextId);

    await this.repository.assertAssignableResources(scopedTenantId, payload);

    const links = payload.salesOrderIds.map((salesOrderId, index) => ({
      salesOrderId,
      sequenceOrder: index + 1
    }));

    return await this.repository.createWithLinks({
      tenantId: scopedTenantId,
      deliveryNumber,
      deliveryDate: new Date(payload.deliveryDate),
      driverId: payload.driverId,
      truckId: payload.truckId,
      notes: payload.notes,
      createdIp: ipAddress,
      updatedIp: ipAddress,
      status: 'pending'
    }, links);
  }

  async update(tenantId, id, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const ipAddress = context.ipAddress ?? null;
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) throw new AppError("Delivery not found", 404);
    assertEditableStatus(existing.status);

    await this.repository.assertAssignableResources(scopedTenantId, {
      salesOrderIds: payload.salesOrderIds || existing.salesOrders.map((so) => so.salesOrderId),
      driverId: payload.driverId !== undefined ? payload.driverId : existing.driverId,
      truckId: payload.truckId !== undefined ? payload.truckId : existing.truckId
    }, {
      excludeDeliveryId: id
    });

    const links = (payload.salesOrderIds || existing.salesOrders.map(so => so.salesOrderId)).map((salesOrderId, index) => ({
      salesOrderId,
      sequenceOrder: index + 1
    }));

    return await this.repository.updateWithLinks(scopedTenantId, id, {
      deliveryDate: payload.deliveryDate ? new Date(payload.deliveryDate) : existing.deliveryDate,
      driverId: payload.driverId !== undefined ? payload.driverId : existing.driverId,
      truckId: payload.truckId !== undefined ? payload.truckId : existing.truckId,
      notes: payload.notes !== undefined ? payload.notes : existing.notes,
      updatedIp: ipAddress
    }, links);
  }

  async updateStatus(tenantId, id, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const ipAddress = context.ipAddress ?? null;
    const userId = context.userId ?? null;
    const status = payload?.status;
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) throw new AppError("Delivery not found", 404);
    assertStatusTransition(existing.status, status);

    if (status === "delivered") {
      return this.repository.updateStatusAndDeliver(scopedTenantId, id, status, {
        ipAddress,
        userId,
        recipientName: payload?.recipientName ?? null,
        deliveryNotes: payload?.deliveryNotes ?? null
      });
    }

    return await this.repository.updateStatus(scopedTenantId, id, status, ipAddress);
  }

  async delete(tenantId, id, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const ipAddress = context.ipAddress ?? null;
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) throw new AppError("Delivery not found", 404);
    assertEditableStatus(existing.status);

    await this.repository.softDelete(scopedTenantId, id, ipAddress);
  }

  async createReceiptPdfDocument(tenantId, id) {
    const delivery = await this.getById(tenantId, id);
    if (!delivery) throw new AppError("Delivery not found", 404);

    const { createDeliveryReceiptPdf } = await import("#modules/deliveries/delivery-receipt-pdf");
    const buffer = await createDeliveryReceiptPdf(delivery, delivery.salesOrders);

    return {
      fileName: `${delivery.deliveryNumber}.pdf`,
      buffer
    };
  }
}
