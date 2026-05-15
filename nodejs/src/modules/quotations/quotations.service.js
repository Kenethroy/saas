import { QuotationsRepository } from "#modules/quotations/quotations.repository";
import { createQuotationPdf } from "#modules/quotations/quotation-pdf";
import { AppError } from "#shared/utils/app-error";

function requireTenantId(tenantId) {
  const normalized = Number(tenantId);
  if (!normalized) throw new AppError("Tenant context is required", 401);
  return normalized;
}

function normalizeQuotation(record) {
  const itemCount = record._count?.items ?? record.items?.length ?? 0;

  return {
    id: Number(record.id),
    quoteNumber: record.quoteNumber,
    customerId: Number(record.customerId),
    contactPerson: record.contactPerson,
    quoteDate: record.quoteDate,
    validUntil: record.validUntil,
    paymentTermId: record.paymentTermId ?? null,
    agentId: record.agentId ? Number(record.agentId) : null,
    status: record.status,
    itemsSubtotal: Number(record.itemsSubtotal),
    discountType: record.discountType,
    discountValue: Number(record.discountValue),
    discountAmount: Number(record.discountAmount),
    totalAmount: Number(record.totalAmount),
    notes: record.notes,
    sentAt: record.sentAt ?? null,
    convertedAt: record.convertedAt ?? null,
    createdAt: record.createdAt ?? null,
    updatedAt: record.updatedAt ?? null,
    itemCount,
    customer: record.customer
      ? {
          id: Number(record.customer.id),
          name: record.customer.name,
          company: record.customer.company ?? null,
          address: record.customer.address ?? null,
          phone: record.customer.phone ?? null,
          email: record.customer.email ?? null
        }
      : null,
    agent: record.agent
      ? {
          id: Number(record.agent.id),
          firstName: record.agent.firstName,
          lastName: record.agent.lastName
        }
      : null,
    paymentTerm: record.paymentTerm
      ? {
          id: record.paymentTerm.id,
          name: record.paymentTerm.name,
          days: record.paymentTerm.days
        }
      : null,
    salesOrder: record.salesOrder
      ? {
          id: Number(record.salesOrder.id),
          salesOrderNumber: record.salesOrder.salesOrderNumber,
          status: record.salesOrder.status
        }
      : null,
    items: (record.items ?? []).map((item) => ({
      id: Number(item.id),
      productId: Number(item.productId),
      productVariantId: Number(item.productVariantId),
      productName: item.productName,
      variantName: item.variantName,
      availableStock: Number(item.productVariant?.stockQuantity ?? 0),
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      unitCost: Number(item.unitCost),
      lineDiscount: Number(item.lineDiscount ?? 0),
      lineTotal: Number(item.lineTotal)
    }))
  };
}

function assertEditableStatus(status) {
  if (!["draft", "sent"].includes(status)) {
    throw new AppError("Only draft and sent quotations can be edited.", 422);
  }
}

function assertDeletableStatus(status) {
  if (!["draft", "rejected", "expired"].includes(status)) {
    throw new AppError("Only draft, rejected, and expired quotations can be deleted.", 422);
  }
}

function assertStatusTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    return;
  }

  if (currentStatus === "converted") {
    throw new AppError("Converted quotations cannot change status.", 422);
  }

  const allowedTransitions = {
    draft: new Set(["sent", "expired"]),
    sent: new Set(["accepted", "rejected", "expired"]),
    accepted: new Set(["expired"]),
    rejected: new Set([]),
    expired: new Set([]),
    converted: new Set([])
  };

  if (!allowedTransitions[currentStatus]?.has(nextStatus)) {
    throw new AppError("Invalid quotation status transition.", 422);
  }
}

export class QuotationsService {
  constructor(repository = new QuotationsRepository()) {
    this.repository = repository;
  }

  async getById(tenantId, id) {
    const scopedTenantId = requireTenantId(tenantId);
    const quotation = await this.repository.findById(scopedTenantId, Number(id));
    if (!quotation) {
      throw new AppError("Quotation not found", 404);
    }

    return normalizeQuotation(quotation);
  }

  async list(tenantId, filters, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const { rows, total } = await this.repository.findPaginated(scopedTenantId, {
      page: filters.page,
      perPage: filters.perPage,
      search: filters.search,
      status: filters.status,
      customerId: filters.customerId,
      agentId: filters.agentId,
      branchId: context.branchId ?? null
    });

    return {
      data: rows.map(normalizeQuotation),
      meta: {
        currentPage: filters.page,
        perPage: filters.perPage,
        total,
        lastPage: Math.ceil(total / filters.perPage) || 1
      }
    };
  }

  async create(tenantId, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const branchId = context.branchId ? Number(context.branchId) : null;
    const { normalizedItems, itemsSubtotal, discountAmount, totalAmount } = await this.prepareQuotationPayload(scopedTenantId, payload, {
      branchId
    });
    const ipAddress = context?.ipAddress ?? null;

    const quotation = await this.repository.createQuotation({
      tenantId: scopedTenantId,
      branchId,
      customer_id: BigInt(payload.customerId),
      contact_person: payload.contactPerson ?? null,
      quote_date: new Date(payload.quoteDate),
      valid_until: new Date(payload.validUntil),
      payment_term_id: payload.paymentTermId ?? null,
      agent_id: payload.agentId ? BigInt(payload.agentId) : null,
      status: payload.status ?? "draft",
      items_subtotal: itemsSubtotal,
      discount_type: payload.discountType,
      discount_value: payload.discountValue ?? 0,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      notes: payload.notes ?? null,
      created_ip: ipAddress,
      updated_ip: ipAddress,
      items: {
        create: normalizedItems.map(item => ({
          product_id: BigInt(item.productId),
          product_variant_id: BigInt(item.productVariantId),
          product_name: item.productName,
          variant_name: item.variantName,
          description: item.description ?? null,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          unit_cost: item.unitCost,
          line_discount: item.lineDiscount,
          line_total: item.lineTotal
        }))
      }
    });

    return normalizeQuotation(quotation);
  }

  async update(tenantId, id, payload, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, Number(id));
    if (!existing) {
      throw new AppError("Quotation not found", 404);
    }

    assertEditableStatus(existing.status);

    const { normalizedItems, itemsSubtotal, discountAmount, totalAmount } = await this.prepareQuotationPayload(scopedTenantId, payload, {
      branchId: context.branchId ? Number(context.branchId) : (existing.branchId ? Number(existing.branchId) : null)
    });
    const ipAddress = context?.ipAddress ?? null;

    await this.repository.updateQuotation(scopedTenantId, Number(id), {
      customer_id: BigInt(payload.customerId),
      contact_person: payload.contactPerson ?? null,
      quote_date: new Date(payload.quoteDate),
      valid_until: new Date(payload.validUntil),
      payment_term_id: payload.paymentTermId ?? null,
      agent_id: payload.agentId ? BigInt(payload.agentId) : null,
      items_subtotal: itemsSubtotal,
      discount_type: payload.discountType,
      discount_value: payload.discountValue ?? 0,
      discount_amount: discountAmount,
      total_amount: totalAmount,
      notes: payload.notes ?? null,
      updated_ip: ipAddress,
      ...(context.branchId ? { branch_id: Number(context.branchId) } : {})
    });

    const updated = await this.repository.replaceQuotationItems(
      scopedTenantId,
      Number(id),
      normalizedItems.map(item => ({
        product_id: BigInt(item.productId),
        product_variant_id: BigInt(item.productVariantId),
        product_name: item.productName,
        variant_name: item.variantName,
        description: item.description ?? null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        unit_cost: item.unitCost,
        line_discount: item.lineDiscount,
        line_total: item.lineTotal
      }))
    );

    return normalizeQuotation(updated);
  }

  async delete(tenantId, id) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, Number(id));
    if (!existing) {
      throw new AppError("Quotation not found", 404);
    }

    assertDeletableStatus(existing.status);
    await this.repository.deleteQuotation(scopedTenantId, Number(id));
  }

  async updateStatus(tenantId, id, status, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, Number(id));
    if (!existing) {
      throw new AppError("Quotation not found", 404);
    }

    if (status === "converted") {
      throw new AppError("Use the convert endpoint to convert quotations.", 422);
    }

    assertStatusTransition(existing.status, status);

    const updated = await this.repository.updateQuotation(scopedTenantId, Number(id), {
      status,
      updated_ip: context?.ipAddress ?? null
    });

    return normalizeQuotation(updated);
  }

  async send(tenantId, id, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, Number(id));
    if (!existing) {
      throw new AppError("Quotation not found", 404);
    }

    if (existing.status !== "draft") {
      throw new AppError("Only draft quotations can be sent.", 422);
    }

    const updated = await this.repository.updateQuotation(scopedTenantId, Number(id), {
      status: "sent",
      sent_at: new Date(),
      updated_ip: context?.ipAddress ?? null
    });

    return normalizeQuotation(updated);
  }

  async convertToSalesOrder(tenantId, id, context = {}) {
    const scopedTenantId = requireTenantId(tenantId);
    const existing = await this.repository.findById(scopedTenantId, Number(id));
    if (!existing) {
      throw new AppError("Quotation not found", 404);
    }

    if (existing.status !== "accepted") {
      throw new AppError("Only accepted quotations can be converted to sales orders.", 422);
    }

    if (existing.salesOrderId) {
      throw new AppError("Quotation has already been converted to a sales order.", 422);
    }

    const converted = await this.repository.convertToSalesOrder(scopedTenantId, Number(id), {
      branchId: context.branchId ? Number(context.branchId) : null,
      ipAddress: context.ipAddress ?? null
    });

    return {
      quotationId: Number(existing.id),
      quoteNumber: existing.quoteNumber,
      salesOrderId: Number(converted.id),
      salesOrderNumber: converted.salesOrderNumber,
      status: "converted"
    };
  }

  async createPdfDocument(tenantId, id) {
    const quotation = await this.getById(tenantId, id);
    const buffer = await createQuotationPdf(quotation);

    return {
      fileName: `${quotation.quoteNumber || `quotation-${id}`}.pdf`,
      buffer
    };
  }

  async prepareQuotationPayload(tenantId, payload, context = {}) {
    const customer = await this.repository.findCustomerById(tenantId, payload.customerId);
    if (!customer) {
      throw new AppError("Customer not found", 404);
    }

    if (payload.agentId) {
      const agent = await this.repository.findAgentById(tenantId, payload.agentId);
      if (!agent) {
        throw new AppError("Agent not found", 404);
      }
    }

    if (payload.paymentTermId) {
      const paymentTerm = await this.repository.findPaymentTermById(tenantId, payload.paymentTermId);
      if (!paymentTerm) {
        throw new AppError("Payment term not found", 404);
      }
    }

    const variantIds = payload.items.map((item) => item.productVariantId);
    const variants = await this.repository.findProductVariantsByIds(tenantId, variantIds, {
      branchId: context.branchId ?? null
    });
    const variantMap = new Map(variants.map((variant) => [Number(variant.id), variant]));

    const normalizedItems = payload.items.map((item) => {
      const variant = variantMap.get(Number(item.productVariantId));
      if (!variant) {
        throw new AppError(`Product variant ${item.productVariantId} not found`, 404);
      }

      const unitPrice = Number(variant.unitPrice || variant.unit_price);
      const unitCost = Number(variant.unitCost || variant.unit_cost);
      const quantity = Number(item.quantity ?? 0);
      const lineSubtotal = quantity * unitPrice;
      const lineDiscount = lineSubtotal * (Number(item.discountPercent ?? 0) / 100);
      const lineTotal = Math.max(0, lineSubtotal - Math.min(lineSubtotal, lineDiscount));

      return {
        productId: Number(variant.productId || variant.product_id),
        productVariantId: Number(variant.id),
        productName: variant.product_name,
        variantName: variant.name,
        description: item.description ?? null,
        quantity,
        unitPrice,
        unitCost,
        lineDiscount,
        lineTotal
      };
    });

    const itemsSubtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    let discountAmount = 0;

    if (payload.discountType === "percentage") {
      discountAmount = itemsSubtotal * (Number(payload.discountValue ?? 0) / 100);
    } else if (payload.discountType === "fixed") {
      discountAmount = Number(payload.discountValue ?? 0);
    }

    discountAmount = Math.min(itemsSubtotal, Math.max(0, discountAmount));
    const totalAmount = Math.max(0, itemsSubtotal - discountAmount);

    return {
      customer,
      normalizedItems,
      itemsSubtotal,
      discountAmount,
      totalAmount
    };
  }
}
