import { AppError } from "#shared/utils/app-error";
import { StockAdjustmentsRepository } from "#modules/stock-adjustments/stock-adjustments.repository";

export class StockAdjustmentsService {
  constructor(repository = new StockAdjustmentsRepository()) {
    this.repository = repository;
  }

  async list(tenantId, filters, context = {}) {
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;
    const sortOrder = String(filters.sortOrder ?? "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    const { rows, total } = await this.repository.findPaginated(tenantId, {
      page,
      perPage,
      search: filters.search,
      status: filters.status,
      reason: filters.reason,
      sortOrder,
      branchId: context.branchId ?? null
    });

    return {
      data: rows,
      meta: {
        currentPage: page,
        perPage,
        total,
        lastPage: Math.ceil(total / perPage) || 1
      }
    };
  }

  async getById(tenantId, id) {
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const header = await this.repository.findById(tenantId, id);
    if (!header) throw new AppError("Stock adjustment not found", 404);

    const variantIds = header.items.map(item => item.productVariantId);
    const variants = await this.repository.findProductVariantsByIds(tenantId, variantIds);
    const variantMap = new Map(variants.map(v => [v.id, v]));

    header.items = header.items.map(item => {
      const variant = variantMap.get(item.productVariantId);
      return {
        ...item,
        id: Number(item.id),
        productName: variant?.product?.name ?? null,
        variantName: variant?.name ?? null,
        restockFlag: Boolean(item.restockFlag)
      };
    });

    return header;
  }

  async create(payload, context = {}) {
    if (!context?.tenantId) throw new AppError("Tenant context is required", 400);
    const header = await this.repository.create(payload, context);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    return this.getById(context.tenantId, header.id);
  }

  async update(id, payload, context = {}) {
    if (!context?.tenantId) throw new AppError("Tenant context is required", 400);
    const header = await this.repository.update(context.tenantId, id, payload, context);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    return this.getById(context.tenantId, header.id);
  }

  async submit(tenantId, id, context = {}) {
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const header = await this.repository.submit(tenantId, id, context);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    return this.getById(tenantId, header.id);
  }

  async approve(tenantId, id, context = {}) {
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const header = await this.repository.approve(tenantId, id, context);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    return this.getById(tenantId, header.id);
  }

  async reject(tenantId, id, reason, context = {}) {
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    const header = await this.repository.reject(tenantId, id, reason, context);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    return this.getById(tenantId, header.id);
  }

  async delete(tenantId, id, context = {}) {
    if (!tenantId) throw new AppError("Tenant context is required", 400);
    await this.repository.delete(tenantId, id, context);
  }
}
