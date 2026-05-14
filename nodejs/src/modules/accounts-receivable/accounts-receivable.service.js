import { AppError } from "#shared/utils/app-error";
import { AccountsReceivableRepository } from "#modules/accounts-receivable/accounts-receivable.repository";

function normalizeAR(record) {
  return {
    id: Number(record.id),
    invoiceId: record.invoiceId ? Number(record.invoiceId) : null,
    invoiceNumber: record.invoice?.invoiceNumber ?? null,
    customerId: Number(record.customerId),
    customerName: record.customer?.name ?? "Unknown",
    customerCompany: record.customer?.company ?? null,
    agentId: record.agentId ? Number(record.agentId) : null,
    agentName: record.agent ? `${record.agent.firstName} ${record.agent.lastName}` : null,
    invoiceDate: record.invoiceDate,
    dueDate: record.dueDate,
    amount: Number(record.amount),
    paidAmount: Number(record.paidAmount),
    outstandingAmount: Number(record.outstandingAmount),
    isOpeningBalance: Boolean(record.isOpeningBalance),
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export class AccountsReceivableService {
  constructor(repository = new AccountsReceivableRepository()) {
    this.repository = repository;
  }

  async list(tenantId, filters) {
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const page = parseInt(filters.page) || 1;
    const perPage = parseInt(filters.perPage) || 10;

    const result = await this.repository.findPaginated(tenantId, {
      search: filters.search,
      status: filters.status,
      customerId: filters.customerId,
      page,
      perPage
    });

    return {
      data: result.data.map(normalizeAR),
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
    const ar = await this.repository.findById(tenantId, id);
    if (!ar) throw new AppError("Accounts Receivable record not found", 404);
    return normalizeAR(ar);
  }

  async update(id, payload, context = {}) {
    const tenantId = context.tenantId;
    if (!tenantId) throw new AppError("Tenant context is required", 400);

    const existing = await this.repository.findById(tenantId, id);
    if (!existing) throw new AppError("Accounts Receivable record not found", 404);

    if (payload.amount !== undefined && existing.paidAmount > 0) {
      throw new AppError("Cannot modify amount because payments have already been applied", 400);
    }

    let outstandingAmount = existing.outstandingAmount;
    if (payload.amount !== undefined) {
      outstandingAmount = payload.amount - existing.paidAmount;
    }

    const ar = await this.repository.update(tenantId, id, {
      ...payload,
      outstandingAmount,
      updatedIp: context.ipAddress ?? null
    });

    return normalizeAR(ar);
  }
}
