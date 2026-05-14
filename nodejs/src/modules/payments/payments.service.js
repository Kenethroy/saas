import { AppError } from "#shared/utils/app-error";
import { PaymentsRepository } from "#modules/payments/payments.repository";
import { toPublicFileUrl } from "#shared/utils/uploads";

function requireTenantId(tenantId) {
  const normalized = Number(tenantId);
  if (!normalized) {
    throw new AppError("Tenant context is required", 401);
  }
  return normalized;
}

function normalizePayment(record) {
  return {
    id: Number(record.id),
    payment_number: record.paymentNumber,
    date: record.paymentDate,
    amount: Number(record.amount),
    payment_method: record.paymentMethod,
    reference_number: record.referenceNumber,
    status: "verified",
    proof_image_url: toPublicFileUrl(record.fileUrl),
    created_at: record.created_at,
    customer: record.customer ? {
      id: Number(record.customer.id),
      name: record.customer.name,
      company: record.customer.company
    } : null,
    allocations: (record.allocations ?? []).map((allocation) => ({
      id: Number(allocation.id),
      invoice_id: allocation.invoiceId ? Number(allocation.invoiceId) : null,
      invoice_number: allocation.invoiceNumber ?? (allocation.is_opening_balance ? "Opening Balance" : null),
      order_number: allocation.salesOrderNumber ?? null,
      allocated_amount: Number(allocation.amountAllocated),
      created_at: allocation.created_at
    }))
  };
}

export class PaymentsService {
  constructor(repository = new PaymentsRepository()) {
    this.repository = repository;
  }

  async list(filters, context = {}) {
    const tenantId = requireTenantId(context.tenantId);
    const page = parseInt(filters.page) || 1;
    const perPage = parseInt(filters.limit || filters.perPage) || 10;

    const { data, total } = await this.repository.findPaginated({
      tenantId,
      page,
      perPage,
      search: filters.search,
      customerId: filters.customerId
    });

    return {
      data: data.map(normalizePayment),
      meta: {
        total,
        page,
        limit: perPage,
        totalPages: Math.ceil(total / perPage)
      }
    };
  }

  async listCustomerPayments(customerId, filters, context = {}) {
    const tenantId = requireTenantId(context.tenantId);
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;

    const { data, total } = await this.repository.findPaginated({
      tenantId,
      page,
      perPage: limit,
      customerId
    });

    return {
      payments: data.map(normalizePayment),
      pagination: {
        current_page: page,
        per_page: limit,
        total,
        total_pages: Math.ceil(total / limit) || 1
      }
    };
  }

  async createCustomerPayment(payload, context = {}) {
    requireTenantId(context.tenantId);
    try {
      return await this.repository.createCustomerPayment(payload, context);
    } catch (error) {
      if (error.message === "Customer not found") {
        throw new AppError(error.message, 404);
      }
      throw error;
    }
  }

  async createSupplierPayment(payload, context = {}) {
    requireTenantId(context.tenantId);
    try {
      return await this.repository.createSupplierPayment(payload, context);
    } catch (error) {
      if (error.message === "Accounts Payable record not found") {
        throw new AppError(error.message, 404);
      }
      throw error;
    }
  }

  async getAccountsPayableHistory(accountsPayableId, context = {}) {
    requireTenantId(context.tenantId);
    if (!accountsPayableId || Number.isNaN(Number(accountsPayableId))) {
      throw new AppError("Invalid accounts payable id", 400);
    }

    return await this.repository.getAccountsPayableHistory(Number(accountsPayableId), context);
  }
}
