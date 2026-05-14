import { CustomerReturnsRepository } from "#modules/customer-returns/customer-returns.repository";

function toDateOnly(value) {
  if (value == null) return value;
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  return value;
}

export class CustomerReturnsService {
  constructor(repository = new CustomerReturnsRepository()) {
    this.repository = repository;
  }

  async getAllReturns(filters) {
    const result = await this.repository.findAll(filters);
    return {
      ...result,
      items: result.items.map(item => ({
        ...item,
        customerName: item.customer.name,
        salesInvoice: item.invoice?.invoiceNumber || "N/A",
        itemCount: item._count.items
      }))
    };
  }

  async getReturnById(id) {
    const record = await this.repository.findById(id);
    if (!record) return null;
    return {
      ...record,
      customerName: record.customer.name,
      items: record.items.map(item => ({
        ...item,
        restockFlag: Boolean(item.restockFlag)
      }))
    };
  }

  async createReturn(data, context = {}) {
    if (!data.rmaNumber) {
      const year = new Date().getFullYear();
      const count = await this.repository.countAll();
      const nextNum = (count + 1).toString().padStart(4, "0");
      data.rmaNumber = `RMA-${year}-${nextNum}`;
    }

    const { items, ...returnData } = data;
    const ipAddress = context.ipAddress || null;

    const { resolvedItems, totalAmount } = await this.repository.resolveValidatedItems(
      null,
      returnData.invoiceId,
      items
    );
    const created = await this.repository.createResolvedReturn({
      ...returnData,
      rmaNumber: data.rmaNumber,
      requestDate: toDateOnly(returnData.requestDate),
      totalAmount,
      ipAddress,
      items: resolvedItems
    });

    return created;
  }

  async updateReturn(id, data, context = {}) {
    const { items, ...returnData } = data;
    const ipAddress = context.ipAddress || null;

    const existing = await this.repository.findById(id);
    const invoiceId = returnData.invoiceId || existing?.invoiceId;

    let resolvedItems;
    let totalAmount = existing?.totalAmount;
    if (items) {
      const resolution = await this.repository.resolveValidatedItems(id, invoiceId, items);
      resolvedItems = resolution.resolvedItems;
      totalAmount = resolution.totalAmount;
    }

    return this.repository.updateResolvedReturn(id, {
      customerId: returnData.customerId,
      invoiceId: returnData.invoiceId || null,
      requestDate: toDateOnly(returnData.requestDate),
      reason: returnData.reason,
      disposition: returnData.disposition,
      totalAmount,
      notes: returnData.notes || null,
      ipAddress,
      items: items ? resolvedItems : undefined
    });
  }

  async approveReturn(id, context = {}) {
    return this.repository.approveReturn(id, context);
  }

  async rejectReturn(id, reason, context = {}) {
    return this.repository.rejectReturn(id, reason, context);
  }

  async deleteReturn(id) {
    await this.repository.softDelete(id);
    return { success: true };
  }

  async getCustomerInvoices(customerId) {
    return this.repository.findCustomerInvoices(customerId);
  }
}
