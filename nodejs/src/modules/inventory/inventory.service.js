import { InventoryRepository } from "#modules/inventory/inventory.repository";
import { AppError } from "#shared/utils/app-error";

function normalizeTransaction(record) {
  return {
    id: Number(record.id),
    productId: Number(record.product_id ?? record.productId),
    productName: record.product?.name ?? record.product_name ?? null,
    productVariantId: Number(record.product_variant_id ?? record.productVariantId),
    variantName: record.productVariant?.name ?? record.variant_name ?? null,
    quantityBefore: Number(record.quantity_before ?? record.quantityBefore ?? 0),
    quantityChange: Number(record.quantity_change ?? record.quantityChange ?? 0),
    quantityAfter: Number(record.quantity_after ?? record.quantityAfter ?? 0),
    transactionType: Number(record.transaction_type ?? record.transactionType),
    referenceType: record.reference_type ?? record.referenceType ?? null,
    referenceId: (record.reference_id ?? record.referenceId) != null ? (record.reference_id ?? record.referenceId).toString() : null,
    reason: record.reason ?? null,
    createdBy: (record.created_by ?? record.createdBy) != null ? (record.created_by ?? record.createdBy).toString() : null,
    createdAt: record.created_at ?? record.createdAt ?? null
  };
}

export class InventoryService {
  constructor(repository = new InventoryRepository()) {
    this.repository = repository;
  }

  async applyStockAdjustment(payload, context = {}) {
    if (!context?.tenantId) {
      throw new AppError("Tenant context is required", 400);
    }

    try {
      const result = await this.repository.applyStockAdjustment(payload, context);
      return normalizeTransaction(result);
    } catch (error) {
      if (error.message === "Product variant not found") {
        throw new AppError(error.message, 404);
      }
      if (error.message === "Stock adjustment would result in negative stock.") {
        throw new AppError(error.message, 422);
      }
      throw error;
    }
  }

  async listTransactions(tenantId, filters, context = {}) {
    if (!tenantId) {
      throw new AppError("Tenant context is required", 400);
    }

    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 25;

    const { rows, total } = await this.repository.findPaginatedTransactions(tenantId, {
      page,
      perPage,
      productId: filters.productId,
      productVariantId: filters.productVariantId,
      transactionType: filters.transactionType,
      referenceType: filters.referenceType,
      search: filters.search,
      sortOrder: filters.sortOrder,
      branchId: context.branchId ?? null
    });

    return {
      data: rows.map(normalizeTransaction),
      meta: {
        currentPage: page,
        perPage,
        total,
        lastPage: Math.ceil(total / perPage) || 1
      }
    };
  }
}
