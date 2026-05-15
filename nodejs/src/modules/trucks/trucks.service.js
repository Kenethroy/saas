import { AppError } from "#shared/utils/app-error";
import { TrucksRepository } from "#modules/trucks/trucks.repository";

function requireTenantId(tenantId) {
  const normalized = Number(tenantId);
  if (!normalized) {
    throw new AppError("Tenant context is required", 401);
  }
  return normalized;
}

function toNumber(value) {
  return value == null ? null : Number(value);
}

function normalizeTruck(record) {
  return {
    id: Number(record.id),
    plateNumber: record.plateNumber,
    model: record.model,
    brand: record.brand,
    year: record.year,
    color: record.color,
    capacityKg: toNumber(record.capacityKg),
    status: record.status,
    notes: record.notes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function normalizeTruckListItem(record) {
  return {
    id: Number(record.id),
    plateNumber: record.plateNumber,
    model: record.model
  };
}

export class TrucksService {
  constructor(repository = new TrucksRepository()) {
    this.repository = repository;
  }

  async list(tenantId, filters, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;

    const result = await this.repository.findPaginated(scopedTenantId, {
      search: filters.search,
      status: filters.status,
      page,
      perPage,
      branchId: context.branchId ?? null
    });

    return {
      data: result.data.map(normalizeTruck),
      meta: {
        currentPage: page,
        perPage,
        total: result.total,
        lastPage: Math.ceil(result.total / perPage) || 1
      }
    };
  }

  async getById(tenantId, id) {
    const truck = await this.repository.findById(requireTenantId(tenantId), id);
    if (!truck) {
      throw new AppError("Truck not found", 404);
    }

    return normalizeTruck(truck);
  }

  async listForAssignment(tenantId, filters, context = {}) {
    const trucks = await this.repository.listForAssignment(requireTenantId(tenantId), {
      search: filters.search,
      branchId: context.branchId ?? null
    });

    return trucks.map(normalizeTruckListItem);
  }

  async create(tenantId, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const plateNumber = payload.plateNumber.trim();
    const duplicate = await this.repository.findByPlateNumber(scopedTenantId, plateNumber);

    if (duplicate && !duplicate.deleteFlag) {
      throw new AppError("Plate number already exists", 409);
    }

    const truck = await this.repository.create({
      tenantId: scopedTenantId,
      branchId: context.branchId ?? null,
      plateNumber,
      model: payload.model ?? null,
      brand: payload.brand ?? null,
      year: payload.year ?? null,
      color: payload.color ?? null,
      capacityKg: payload.capacityKg ?? null,
      status: payload.status ?? "active",
      notes: payload.notes ?? null,
      createdIp: context.ipAddress ?? null,
      updatedIp: context.ipAddress ?? null
    });

    return { id: Number(truck.id) };
  }

  async update(tenantId, id, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) {
      throw new AppError("Truck not found", 404);
    }

    if (payload.plateNumber) {
      const duplicate = await this.repository.findByPlateNumber(scopedTenantId, payload.plateNumber.trim());
      if (duplicate && Number(duplicate.id) !== Number(id) && !duplicate.deleteFlag) {
        throw new AppError("Plate number already exists", 409);
      }
    }

    await this.repository.update(scopedTenantId, id, {
      branchId: context.branchId ?? existing.branchId ?? null,
      plateNumber: payload.plateNumber === undefined ? existing.plateNumber : payload.plateNumber.trim(),
      model: payload.model === undefined ? existing.model : payload.model,
      brand: payload.brand === undefined ? existing.brand : payload.brand,
      year: payload.year === undefined ? existing.year : payload.year,
      color: payload.color === undefined ? existing.color : payload.color,
      capacityKg: payload.capacityKg === undefined ? existing.capacityKg : payload.capacityKg,
      status: payload.status ?? existing.status,
      notes: payload.notes === undefined ? existing.notes : payload.notes,
      updatedIp: context.ipAddress ?? null
    });
  }

  async delete(tenantId, id, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) {
      throw new AppError("Truck not found", 404);
    }

    await this.repository.update(scopedTenantId, id, {
      deleteFlag: true,
      status: "inactive",
      updatedIp: context.ipAddress ?? null
    });
  }
}
