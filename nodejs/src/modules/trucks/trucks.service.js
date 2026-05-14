import { AppError } from "#shared/utils/app-error";
import { TrucksRepository } from "#modules/trucks/trucks.repository";

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

  async list(filters) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;

    const result = await this.repository.findPaginated({
      search: filters.search,
      status: filters.status,
      page,
      perPage
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

  async getById(id) {
    const truck = await this.repository.findById(id);
    if (!truck) {
      throw new AppError("Truck not found", 404);
    }

    return normalizeTruck(truck);
  }

  async listForAssignment(filters) {
    const trucks = await this.repository.listForAssignment({
      search: filters.search
    });

    return trucks.map(normalizeTruckListItem);
  }

  async create(payload, context = {}) {
    const plateNumber = payload.plateNumber.trim();
    const duplicate = await this.repository.findByPlateNumber(plateNumber);

    if (duplicate && !duplicate.deleteFlag) {
      throw new AppError("Plate number already exists", 409);
    }

    const truck = await this.repository.create({
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

  async update(id, payload, context = {}) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("Truck not found", 404);
    }

    if (payload.plateNumber) {
      const duplicate = await this.repository.findByPlateNumber(payload.plateNumber.trim());
      if (duplicate && Number(duplicate.id) !== Number(id) && !duplicate.deleteFlag) {
        throw new AppError("Plate number already exists", 409);
      }
    }

    await this.repository.update(id, {
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

  async delete(id, context = {}) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new AppError("Truck not found", 404);
    }

    await this.repository.update(id, {
      deleteFlag: true,
      status: "inactive",
      updatedIp: context.ipAddress ?? null
    });
  }
}
