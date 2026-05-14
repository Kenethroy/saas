import { PayslipsRepository } from "#modules/payslips/payslips.repository";
import { AppError } from "#shared/utils/app-error";

export class PayslipsService {
  constructor(repository = new PayslipsRepository()) {
    this.repository = repository;
  }

  async list(tenantId, filters) {
    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;

    const { data, total } = await this.repository.findPaginated(tenantId, {
      page,
      limit,
      employeeId: filters.employee_id ? Number(filters.employee_id) : undefined,
      dateFrom: filters.date_from,
      dateTo: filters.date_to,
      status: filters.status
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  async show(tenantId, id) {
    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }
    return this.repository.findById(tenantId, Number(id));
  }

  async create(payload, context) {
    if (!context?.tenantId) {
      throw new AppError("Tenant context is required", 400);
    }
    return this.repository.create(payload, context);
  }

  async update(tenantId, id, payload, context) {
    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }
    return this.repository.update(tenantId, Number(id), payload, context);
  }

  async delete(tenantId, id, context) {
    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }
    return this.repository.delete(tenantId, Number(id), context);
  }
}

