import { AppError } from "#shared/utils/app-error";
import { AccountsPayableRepository } from "#modules/accounts-payable/accounts-payable.repository";

function normalizeAP(record) {
  return {
    id: Number(record.id),
    purchaseOrderId: Number(record.purchaseOrderId),
    supplierId: Number(record.supplierId),
    poNumber: record.poNumber,
    supplierName: record.supplier?.name ?? "Unknown",
    supplierCompany: record.supplier?.companyName ?? null,
    supplierContact: record.supplier?.contactPerson ?? null,
    supplierPhone: record.supplier?.phone ?? null,
    receiptDate: record.receiptDate,
    dueDate: record.dueDate ?? null,
    amount: Number(record.amount),
    paidAmount: Number(record.paidAmount),
    outstandingAmount: Number(record.outstandingAmount),
    status: record.status,
    notes: record.notes ?? null,
    poOrderDate: record.purchaseOrder?.orderDate ?? null,
    poTotalAmount: Number(record.purchaseOrder?.totalAmount ?? 0),
    poReceivedTotal: record.purchaseOrder?.receivedTotal ? Number(record.purchaseOrder.receivedTotal) : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export class AccountsPayableService {
  constructor(repository = new AccountsPayableRepository()) {
    this.repository = repository;
  }

  async list(tenantId, filters) {
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const page = parseInt(filters.page) || 1;
    const perPage = parseInt(filters.perPage) || 15;

    const result = await this.repository.findPaginated(tenantId, {
      search: filters.search,
      status: filters.status,
      supplierId: filters.supplierId,
      overdue: filters.overdue,
      page,
      perPage
    });

    return {
      data: result.data.map(normalizeAP),
      meta: {
        currentPage: page,
        perPage,
        total: result.total,
        lastPage: Math.ceil(result.total / perPage) || 1
      }
    };
  }

  async getById(tenantId, id) {
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const ap = await this.repository.findById(tenantId, id);
    if (!ap) throw new AppError("Accounts Payable record not found", 404);
    return normalizeAP(ap);
  }

  async update(id, payload, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) throw new AppError("Tenant context is required", 400);

    const existing = await this.repository.findById(tenantId, id);
    if (!existing) throw new AppError("Accounts Payable record not found", 404);

    if (payload.amount !== undefined && Number(existing.paidAmount) > 0) {
      throw new AppError("Cannot modify amount because payments have already been applied", 400);
    }

    let outstandingAmount = Number(existing.outstandingAmount);
    if (payload.amount !== undefined) {
      outstandingAmount = payload.amount - Number(existing.paidAmount);
    }

    const ap = await this.repository.update(id, {
      ...payload,
      outstandingAmount,
      updatedIp: context.ipAddress ?? null,
      tenantId
    });

    return normalizeAP(ap);
  }
}
