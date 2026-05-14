import { AppError } from "#shared/utils/app-error";
import { ProductsRepository } from "#modules/products/products.repository";
import { buildProductUploadUrl, deleteUploadedFile, toPublicFileUrl, toStoredUploadPath } from "#shared/utils/uploads";
import { createProductBrochurePdf } from "#modules/products/product-brochure-pdf";

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

function normalizeVariant(record) {
  return {
    id: Number(record.id),
    productId: Number(record.productId ?? record.product_id),
    name: record.name,
    unitCost: toNumber(record.unitCost ?? record.unit_cost) ?? 0,
    unitPrice: toNumber(record.unitPrice ?? record.unit_price) ?? 0,
    stockQuantity: record.stockQuantity ?? record.stock_quantity ?? 0,
    reorderLevel: record.reorderLevel ?? record.reorder_level ?? 0,
    status: record.status,
    createdAt: record.createdAt ?? record.created_at ?? null,
    updatedAt: record.updatedAt ?? record.updated_at ?? null
  };
}

function normalizeOrderableVariant(record) {
  const onHand = Number(record.stockQuantity ?? record.stock_quantity ?? 0);
  const reserved = Number(record.reservedQuantity ?? record.reserved_quantity ?? 0);
  const available = onHand - reserved;

  return {
    id: Number(record.id),
    productId: Number(record.productId ?? record.product_id),
    name: record.name,
    productName: record.product?.name ?? null,
    fileUrl: toPublicFileUrl(record.product?.fileUrl),
    categoryId: record.product?.categoryId ?? null,
    category: record.product?.category?.name ?? null,
    price: toNumber(record.unitPrice ?? record.unit_price) ?? 0,
    cost: toNumber(record.unitCost ?? record.unit_cost) ?? 0,
    stock: onHand,
    onHand,
    reserved,
    available,
    reorderLevel: record.reorderLevel ?? record.reorder_level
  };
}

const INVENTORY_STOCK_STATUS_ORDER = {
  out_of_stock: 0,
  low_stock: 1,
  in_stock: 2
};

function buildInventoryLabel(productName, variantName) {
  if (!variantName) return productName ?? "Product";
  return `${productName ?? "Product"} ${variantName}`;
}

function resolveInventoryStockStatus(available, reorderLevel) {
  if (available <= 0) return "out_of_stock";
  if (available <= reorderLevel) return "low_stock";
  return "in_stock";
}

function normalizeInventoryOverviewRow(record, reservedQuantity = 0) {
  const onHand = Number(record.stockQuantity ?? record.stock_quantity ?? 0);
  const reorderLevel = Number(record.reorderLevel ?? record.reorder_level ?? 0);
  const reserved = Number(reservedQuantity ?? 0);
  const available = onHand - reserved;
  const stockStatus = resolveInventoryStockStatus(available, reorderLevel);

  return {
    id: Number(record.id),
    productId: Number(record.productId ?? record.product_id),
    categoryId: record.product?.categoryId ?? null,
    categoryName: record.product?.category?.name ?? "Uncategorized",
    productName: record.product?.name ?? "Product",
    variantName: record.name ?? "",
    label: buildInventoryLabel(record.product?.name, record.name),
    onHand,
    reserved,
    available,
    reorderLevel,
    stockStatus,
    updatedAt: record.updatedAt ?? record.updated_at ?? null
  };
}

function normalizeProduct(record) {
  const variants = (record.variants ?? []).map(normalizeVariant);

  return {
    id: Number(record.id),
    categoryId: record.categoryId,
    category: record.category
      ? {
          id: record.category.id,
          name: record.category.name
        }
      : null,
    name: record.name,
    fileUrl: toPublicFileUrl(record.fileUrl),
    status: record.status,
    variantCount: variants.length,
    variants,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function mapVariantPayload(variant) {
  return {
    name: variant.name,
    unitCost: variant.unitCost ?? 0,
    unitPrice: variant.unitPrice ?? 0,
    stockQuantity: variant.stockQuantity ?? 0,
    reorderLevel: variant.reorderLevel ?? 0,
    status: variant.status ?? true
  };
}

export class ProductsService {
  constructor(repository = new ProductsRepository()) {
    this.repository = repository;
  }

  async list(tenantId, filters) {
    const scopedTenantId = requireTenantId(tenantId);
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 10;

    const result = await this.repository.findPaginated(scopedTenantId, {
      search: filters.search,
      categoryId: filters.categoryId,
      status: filters.status
    }, {
      page,
      perPage
    });

    return {
      data: result.data.map(normalizeProduct),
      meta: {
        currentPage: page,
        perPage,
        total: result.total,
        lastPage: Math.ceil(result.total / perPage) || 1
      }
    };
  }

  async getById(tenantId, id) {
    const product = await this.repository.findById(requireTenantId(tenantId), id);
    if (!product) throw new AppError("Product not found", 404);
    return normalizeProduct(product);
  }

  async listForSalesOrder(tenantId, filters) {
    const scopedTenantId = requireTenantId(tenantId);
    const variants = await this.repository.listOrderableVariants(scopedTenantId, {
      search: filters.search,
      categoryId: filters.categoryId,
      context: filters.context
    });

    const reservedQuantities = await this.repository.sumReservedQuantitiesByVariantIds(
      scopedTenantId,
      variants.map((variant) => Number(variant.id)),
      {
        excludeSalesOrderId: filters.salesOrderId
      }
    );

    const reservedByVariantId = new Map(
      reservedQuantities.map((entry) => [Number(entry.productVariantId), Number(entry._sum.quantity ?? 0)])
    );

    return variants.map((variant) =>
      normalizeOrderableVariant({
        ...variant,
        reservedQuantity: reservedByVariantId.get(Number(variant.id)) ?? 0
      })
    );
  }

  async listInventoryOverview(tenantId, filters) {
    const scopedTenantId = requireTenantId(tenantId);
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 12;

    const variants = await this.repository.findInventoryOverviewVariants(scopedTenantId, {
      search: filters.search,
      categoryId: filters.categoryId
    });

    const reservedQuantities = await this.repository.sumReservedQuantitiesByVariantIds(
      scopedTenantId,
      variants.map((variant) => Number(variant.id))
    );

    const reservedByVariantId = new Map(
      reservedQuantities.map((entry) => [Number(entry.productVariantId), Number(entry._sum.quantity ?? 0)])
    );

    const filteredRows = variants
      .map((variant) => normalizeInventoryOverviewRow(variant, reservedByVariantId.get(Number(variant.id)) ?? 0))
      .filter((row) => !filters.stockStatus || row.stockStatus === filters.stockStatus)
      .sort((left, right) => {
        const statusSort =
          (INVENTORY_STOCK_STATUS_ORDER[left.stockStatus] ?? 99) - (INVENTORY_STOCK_STATUS_ORDER[right.stockStatus] ?? 99);

        if (statusSort !== 0) return statusSort;
        if (left.available !== right.available) return left.available - right.available;
        return left.label.localeCompare(right.label);
      });

    const total = filteredRows.length;
    const lastPage = Math.ceil(total / perPage) || 1;
    const safePage = Math.min(page, lastPage);
    const offset = (safePage - 1) * perPage;
    const data = filteredRows.slice(offset, offset + perPage);
    const summary = filteredRows.reduce(
      (acc, row) => {
        acc.variantCount += 1;
        acc.onHand += row.onHand;
        acc.reserved += row.reserved;
        acc.available += row.available;
        acc[row.stockStatus] += 1;
        return acc;
      },
      {
        variantCount: 0,
        onHand: 0,
        reserved: 0,
        available: 0,
        in_stock: 0,
        low_stock: 0,
        out_of_stock: 0
      }
    );

    return {
      data,
      meta: {
        currentPage: safePage,
        perPage,
        total,
        lastPage,
        summary
      }
    };
  }

  async uploadImage(uploadedImage) {
    if (!uploadedImage) {
      throw new AppError("Product image is required", 422, {
        fieldErrors: { image: ["Product image is required"] }
      });
    }

    const relativeFileUrl = buildProductUploadUrl(uploadedImage.filename);
    return { fileUrl: toPublicFileUrl(relativeFileUrl) };
  }

  async deleteUploadedImage(tenantId, fileUrl) {
    const scopedTenantId = requireTenantId(tenantId);
    const storedFileUrl = toStoredUploadPath(fileUrl);
    if (!storedFileUrl) {
      throw new AppError("Invalid product image URL", 422, {
        fieldErrors: { fileUrl: ["Invalid product image URL"] }
      });
    }

    const usageCount = await this.repository.countProductsByFileUrl(scopedTenantId, storedFileUrl);
    if (usageCount > 0) {
      throw new AppError("Cannot delete an image that is already assigned to a product", 409);
    }

    deleteUploadedFile(storedFileUrl);
  }

  async create(tenantId, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const category = await this.repository.findCategoryById(scopedTenantId, payload.categoryId);
    if (!category) throw new AppError("Category not found", 404);

    const variantsData = (payload.variants && payload.variants.length > 0)
      ? payload.variants.map((v) => ({
          ...mapVariantPayload(v),
          createdIp: context.ipAddress ?? null,
          updatedIp: context.ipAddress ?? null
        }))
      : [{
          name: "",
          unitCost: payload.unitCost ?? 0,
          unitPrice: payload.unitPrice ?? 0,
          stockQuantity: payload.stockQuantity ?? 0,
          reorderLevel: payload.reorderLevel ?? 0,
          status: true,
          createdIp: context.ipAddress ?? null,
          updatedIp: context.ipAddress ?? null
        }];

    const product = await this.repository.createWithVariants({
      tenantId: scopedTenantId,
      categoryId: payload.categoryId,
      name: payload.name,
      fileUrl: toStoredUploadPath(payload.fileUrl) ?? null,
      status: payload.status ?? true,
      createdIp: context.ipAddress ?? null,
      updatedIp: context.ipAddress ?? null
    }, variantsData);

    return normalizeProduct(product);
  }

  async update(tenantId, id, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) throw new AppError("Product not found", 404);

    if (payload.categoryId) {
      const category = await this.repository.findCategoryById(scopedTenantId, payload.categoryId);
      if (!category) throw new AppError("Category not found", 404);
    }

    let nextFileUrl = existing.fileUrl;
    let oldFileToDelete = null;

    if (payload.fileUrl !== undefined) {
      const storedFileUrl = toStoredUploadPath(payload.fileUrl);
      nextFileUrl = storedFileUrl;

      if (existing.fileUrl && existing.fileUrl !== storedFileUrl) {
        oldFileToDelete = existing.fileUrl;
      }
    }

    const product = await this.repository.updateProduct(scopedTenantId, id, {
      categoryId: payload.categoryId ?? existing.categoryId,
      name: payload.name ?? existing.name,
      fileUrl: nextFileUrl,
      status: payload.status ?? existing.status,
      updatedIp: context.ipAddress ?? null
    });

    if (oldFileToDelete) deleteUploadedFile(oldFileToDelete);
    return normalizeProduct(product);
  }

  async createVariant(tenantId, productId, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const product = await this.repository.findById(scopedTenantId, productId);
    if (!product) throw new AppError("Product not found", 404);

    const variant = await this.repository.createVariant({
      tenantId: scopedTenantId,
      productId: Number(productId),
      ...mapVariantPayload(payload),
      createdIp: context.ipAddress ?? null,
      updatedIp: context.ipAddress ?? null
    });

    return normalizeVariant(variant);
  }

  async updateVariant(tenantId, id, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findVariantById(scopedTenantId, id);
    if (!existing) throw new AppError("Product variant not found", 404);

    if (payload.stockQuantity !== undefined) {
      throw new AppError("Stock quantity cannot be updated from Products. Use Stock Adjustments.", 422);
    }

    const variant = await this.repository.updateVariant(scopedTenantId, id, {
      name: payload.name ?? existing.name,
      unitCost: payload.unitCost ?? existing.unitCost,
      unitPrice: payload.unitPrice ?? existing.unitPrice,
      reorderLevel: payload.reorderLevel ?? existing.reorderLevel,
      status: payload.status ?? existing.status,
      updatedIp: context.ipAddress ?? null
    });

    return normalizeVariant(variant);
  }

  async delete(tenantId, id, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, id);
    if (!existing) throw new AppError("Product not found", 404);
    await this.repository.softDeleteProduct(scopedTenantId, id, context.ipAddress ?? null);
  }

  async deleteVariant(tenantId, id, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findVariantById(scopedTenantId, id);
    if (!existing) throw new AppError("Product variant not found", 404);

    const variantCount = await this.repository.countProductVariants(scopedTenantId, existing.productId);
    if (variantCount <= 1) {
      throw new AppError("This product must keep at least one variant. Mark it inactive or delete the product instead.", 409);
    }

    await this.repository.updateVariant(scopedTenantId, id, {
      deleteFlag: true,
      status: false,
      updatedIp: context.ipAddress ?? null
    });
  }

  async createBrochurePdfDocument(tenantId) {
    const categories = await this.repository.listBrochureByCategory(requireTenantId(tenantId));
    const document = await createProductBrochurePdf(categories);
    return { 
      document, 
      fileName: "product-price-list.pdf" 
    };
  }
}
