import { CustomerReturnsRepository } from "#modules/customer-returns/customer-returns.repository";
import { allocateDocumentNumber } from "#shared/utils/document-sequences";
import { AppError } from "#shared/utils/app-error";

function requireTenantId(tenantId) {
  const normalized = Number(tenantId);
  if (!normalized) {
    throw new AppError("Tenant context is required", 401);
  }
  return normalized;
}

function toDateOnly(value) {
  if (value == null) return value;
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  return value;
}

export class CustomerReturnsService {
  constructor(repository = new CustomerReturnsRepository()) {
    this.repository = repository;
  }

  async getAllReturns(tenantId, filters = {}, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const result = await this.repository.findAll(scopedTenantId, {
      ...filters,
      branchId: context.branchId ?? null
    });
    return {
      ...result,
      items: result.items.map(item => ({
        ...item,
        customerName: item.customer.name,
        salesInvoice: item.invoice?.invoiceNumber || "N/A",
        itemCount: item._count.items
      }))
    };
  }

  async getReturnById(tenantId, id) {
    const record = await this.repository.findById(requireTenantId(tenantId), id);
    if (!record) return null;
    return {
      ...record,
      customerName: record.customer.name,
      items: record.items.map(item => ({
        ...item,
        restockFlag: Boolean(item.restockFlag)
      }))
    };
  }

  async createReturn(tenantId, data, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const branchId = context.branchId ? Number(context.branchId) : null;

    if (!data.rmaNumber) {
      data.rmaNumber = await allocateDocumentNumber({
        tenantId: scopedTenantId,
        branchId,
        documentType: "customer_return",
        at: data.requestDate ? new Date(data.requestDate) : new Date()
      });
    }

    const { items, ...returnData } = data;
    const ipAddress = context.ipAddress || null;

    const { resolvedItems, totalAmount } = await this.repository.resolveValidatedItems(
      scopedTenantId,
      null,
      returnData.invoiceId,
      items
    );
    const created = await this.repository.createResolvedReturn({
      tenantId: scopedTenantId,
      branchId,
      ...returnData,
      rmaNumber: data.rmaNumber,
      requestDate: toDateOnly(returnData.requestDate),
      totalAmount,
      ipAddress,
      items: resolvedItems
    });

    return created;
  }

  async updateReturn(tenantId, id, data, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const { items, ...returnData } = data;
    const ipAddress = context.ipAddress || null;
    const branchId = context.branchId ? Number(context.branchId) : null;

    const existing = await this.repository.findById(scopedTenantId, id);
    const invoiceId = returnData.invoiceId || existing?.invoiceId;

    let resolvedItems;
    let totalAmount = existing?.totalAmount;
    if (items) {
      const resolution = await this.repository.resolveValidatedItems(scopedTenantId, id, invoiceId, items);
      resolvedItems = resolution.resolvedItems;
      totalAmount = resolution.totalAmount;
    }

    return this.repository.updateResolvedReturn(scopedTenantId, id, {
      branchId,
      customerId: returnData.customerId,
      invoiceId: returnData.invoiceId || null,
      requestDate: toDateOnly(returnData.requestDate),
      reason: returnData.reason,
      disposition: returnData.disposition,
      totalAmount,
      notes: returnData.notes || null,
      ipAddress,
      items: items ? resolvedItems : undefined
    });
  }

  async approveReturn(tenantId, id, context = {}) {
    return this.repository.approveReturn(requireTenantId(tenantId), id, context);
  }

  async rejectReturn(tenantId, id, reason, context = {}) {
    return this.repository.rejectReturn(requireTenantId(tenantId), id, reason, context);
  }

  async deleteReturn(tenantId, id) {
    await this.repository.softDelete(requireTenantId(tenantId), id);
    return { success: true };
  }

  async getCustomerInvoices(tenantId, customerId, context = {}) {
    return this.repository.findCustomerInvoices(
      requireTenantId(tenantId),
      customerId,
      context.branchId ?? null
    );
  }
}
