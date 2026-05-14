import { AppError } from "#shared/utils/app-error";
import { StockAdjustmentsRepository } from "#modules/stock-adjustments/stock-adjustments.repository";

export class StockAdjustmentsService {
  constructor(repository = new StockAdjustmentsRepository()) {
    this.repository = repository;
  }

  async list(filters) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;
    const sortOrder = String(filters.sortOrder ?? "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

    const { rows, total } = await this.repository.findPaginated({
      page,
      perPage,
      search: filters.search,
      status: filters.status,
      reason: filters.reason,
      sortOrder
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

  async getById(id) {
    const header = await this.repository.findById(id);
    if (!header) throw new AppError("Stock adjustment not found", 404);

    const variantIds = header.items.map(item => item.productVariantId);
    const variants = await this.repository.findProductVariantsByIds(variantIds);
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
    const header = await this.repository.create(payload, context);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    return this.getById(header.id);
  }

  async update(id, payload, context = {}) {
    const header = await this.repository.update(id, payload, context);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    return this.getById(header.id);
  }

  async submit(id, context = {}) {
    const header = await this.repository.submit(id, context);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    return this.getById(header.id);
  }

  async approve(id, context = {}) {
    const header = await this.repository.approve(id, context);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    return this.getById(header.id);
  }

  async reject(id, reason, context = {}) {
    const header = await this.repository.reject(id, reason, context);
    if (!header) {
      throw new AppError("Stock adjustment not found", 404);
    }
    return this.getById(header.id);
  }

  async delete(id, context = {}) {
    await this.repository.delete(id, context);
  }
}
