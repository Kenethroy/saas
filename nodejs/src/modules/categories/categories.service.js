import { AppError } from "#shared/utils/app-error";
import { CategoriesRepository } from "#modules/categories/categories.repository";

function requireTenantId(tenantId) {
  const normalized = Number(tenantId);
  if (!normalized) {
    throw new AppError("Tenant context is required", 401);
  }
  return normalized;
}

function normalizeCategory(record) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    status: record.status,
    productCount: record.productCount ?? record._count?.products ?? 0,
    variantCount: record.variantCount ?? 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export class CategoriesService {
  constructor(repository = new CategoriesRepository()) {
    this.repository = repository;
  }

  async list(tenantId, filters) {
    const scopedTenantId = requireTenantId(tenantId);
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;

    const result = await this.repository.findPaginated(
      scopedTenantId,
      {
        search: filters.search,
        status: filters.status
      },
      {
        page,
        perPage
      }
    );

    return {
      data: result.data.map(normalizeCategory),
      meta: {
        currentPage: page,
        perPage,
        total: result.total,
        lastPage: Math.ceil(result.total / perPage) || 1
      }
    };
  }

  async getById(tenantId, id) {
    const category = await this.repository.findById(requireTenantId(tenantId), id);
    if (!category) throw new AppError("Category not found", 404);
    return normalizeCategory(category);
  }

  async listForSelection(tenantId) {
    const categories = await this.repository.findListWithVariantCounts(requireTenantId(tenantId));
    return categories
      .filter((category) => category.variantCount > 0)
      .map(normalizeCategory);
  }

  async listOptions(tenantId) {
    return this.repository.findActiveOptions(requireTenantId(tenantId));
  }

  async create(tenantId, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findByName(scopedTenantId, payload.name);
    if (existing && !existing.deleteFlag) {
      throw new AppError("Category already exists", 409);
    }

    const category = await this.repository.create({
      tenantId: scopedTenantId,
      name: payload.name,
      description: payload.description ?? null,
      createdIp: context.ipAddress ?? null,
      updatedIp: context.ipAddress ?? null
    });

    return { id: category.id };
  }

  async update(tenantId, id, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) throw new AppError("Category not found", 404);

    const duplicate = await this.repository.findByName(scopedTenantId, payload.name);
    if (duplicate && duplicate.id !== Number(id) && !duplicate.deleteFlag) {
      throw new AppError("Category already exists", 409);
    }

    await this.repository.update(scopedTenantId, id, {
      name: payload.name,
      description: payload.description ?? null,
      updatedIp: context.ipAddress ?? null
    });
  }

  async delete(tenantId, id, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) throw new AppError("Category not found", 404);

    const productCount = existing.productCount ?? existing._count?.products ?? 0;
    if (productCount > 0) {
      throw new AppError("Cannot delete category because it still has linked products.", 409);
    }

    await this.repository.update(scopedTenantId, id, {
      deleteFlag: true,
      status: false,
      updatedIp: context.ipAddress ?? null
    });
  }
}
