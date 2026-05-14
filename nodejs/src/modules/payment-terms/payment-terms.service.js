import { AppError } from "#shared/utils/app-error";
import { PaymentTermsRepository } from "#modules/payment-terms/payment-terms.repository";

function requireTenantId(tenantId) {
  const normalized = Number(tenantId);
  if (!normalized) {
    throw new AppError("Tenant context is required", 401);
  }
  return normalized;
}

function normalizePaymentTerm(record) {
  return {
    id: record.id,
    name: record.name,
    days: record.days,
    status: Boolean(record.status),
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

export class PaymentTermsService {
  constructor(repository = new PaymentTermsRepository()) {
    this.repository = repository;
  }

  async list(tenantId, filters) {
    const terms = await this.repository.findAll({
      tenantId: requireTenantId(tenantId),
      search: filters.search,
      status: filters.status
    });
    return terms.map(normalizePaymentTerm);
  }

  async getById(tenantId, id) {
    const term = await this.repository.findById(requireTenantId(tenantId), id);
    if (!term) throw new AppError("Payment term not found", 404);
    return normalizePaymentTerm(term);
  }

  async create(tenantId, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findByName(scopedTenantId, payload.name);
    if (existing && !existing.delete_flg) {
      throw new AppError("Payment term already exists", 409);
    }

    const term = await this.repository.create({
      tenantId: scopedTenantId,
      name: payload.name,
      days: payload.days,
      createdIp: context.ipAddress ?? null,
      updatedIp: context.ipAddress ?? null
    });

    return { id: term.id };
  }

  async update(tenantId, id, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) throw new AppError("Payment term not found", 404);

    if (payload.name) {
      const duplicate = await this.repository.findByName(scopedTenantId, payload.name);
      if (duplicate && Number(duplicate.id) !== Number(id) && !duplicate.delete_flg) {
        throw new AppError("Payment term already exists", 409);
      }
    }

    await this.repository.update(scopedTenantId, id, {
      name: payload.name,
      days: payload.days,
      updatedIp: context.ipAddress ?? null
    });
  }

  async delete(tenantId, id, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) throw new AppError("Payment term not found", 404);

    await this.repository.update(scopedTenantId, id, {
      deleteFlag: true,
      status: false,
      updatedIp: context.ipAddress ?? null
    });
  }
}
