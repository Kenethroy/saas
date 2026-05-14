import { PayslipsRepository } from "#modules/payslips/payslips.repository";

export class PayslipsService {
  constructor(repository = new PayslipsRepository()) {
    this.repository = repository;
  }

  async list(filters) {
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 10;

    const { data, total } = await this.repository.findPaginated({
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

  async show(id) {
    return this.repository.findById(Number(id));
  }

  async create(payload, context) {
    return this.repository.create(payload, context);
  }

  async update(id, payload, context) {
    return this.repository.update(Number(id), payload, context);
  }

  async delete(id, context) {
    return this.repository.delete(Number(id), context);
  }
}

