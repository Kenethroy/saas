import { CustomersService } from "#modules/customers/customers.service";
import { ProductsService } from "#modules/products/products.service";
import { suppliersService } from "#modules/suppliers/suppliers.service";
import { AssistantEmbeddingProvider } from "#shared/ai/embedding-provider";

function toKeywordSlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function uniqueKeywords(values = []) {
  return [...new Set(values.flatMap((value) => toKeywordSlug(value)))];
}

function splitSectionsIntoChunks(sections = [], maxLength = 700) {
  const chunks = [];
  let current = [];
  let currentLength = 0;

  for (const section of sections.filter(Boolean)) {
    const length = section.length;

    if (current.length > 0 && currentLength + length + 2 > maxLength) {
      chunks.push(current.join("\n\n"));
      current = [section];
      currentLength = length;
      continue;
    }

    current.push(section);
    currentLength += length + 2;
  }

  if (current.length > 0) {
    chunks.push(current.join("\n\n"));
  }

  return chunks;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function buildCustomerSections({ customer, statistics, performanceInsight, unpaidOrders, recentPayments }) {
  const customerLabel = customer.company_name || customer.company || customer.name;
  const largestOverdue = [...unpaidOrders]
    .filter((entry) => entry.is_overdue)
    .sort((left, right) => right.outstanding_amount - left.outstanding_amount)[0] ?? null;
  const latestPayment = recentPayments[0] ?? null;

  return [
    [
      `Customer Profile`,
      `Customer: ${customerLabel}`,
      `Customer ID: ${customer.id}`,
      `Status: ${Number(customer.status ?? 0) === 1 ? "Active" : "Inactive"}`,
      `Payment Terms: ${customer.payment_terms ?? "N/A"}`,
      `Address: ${customer.address ?? "N/A"}`
    ].join("\n"),
    [
      `Receivables Summary`,
      `Outstanding Receivables: ${formatCurrency(statistics.total_outstanding)}`,
      `Overdue Receivables: ${formatCurrency(statistics.total_overdue)}`,
      `Overdue Item Count: ${statistics.overdue_orders_count}`,
      `Current Aging Bucket: ${formatCurrency(statistics.aging?.current ?? 0)}`,
      `1-30 Days Aging: ${formatCurrency(statistics.aging?.days_1_30 ?? 0)}`,
      `31-60 Days Aging: ${formatCurrency(statistics.aging?.days_31_60 ?? 0)}`,
      `61-90 Days Aging: ${formatCurrency(statistics.aging?.days_61_90 ?? 0)}`,
      `Over 90 Days Aging: ${formatCurrency(statistics.aging?.over_90 ?? 0)}`
    ].join("\n"),
    [
      `Operational Summary`,
      `Total Orders: ${statistics.total_orders}`,
      `Total Spent: ${formatCurrency(statistics.total_spent)}`,
      `Orders This Month: ${statistics.orders_this_month}`,
      `Orders Growth Percent: ${statistics.orders_growth_percent}`,
      `Total Returns: ${statistics.total_returns}`,
      `Return Rate Percent: ${statistics.return_rate_percent}`,
      `Narrative Insight: ${performanceInsight}`
    ].join("\n"),
    [
      `Recent Activity`,
      latestPayment
        ? `Latest Payment: ${latestPayment.payment_number} on ${formatDate(latestPayment.date)} for ${formatCurrency(latestPayment.amount)}`
        : `Latest Payment: None recorded`,
      largestOverdue
        ? `Largest Overdue Reference: ${largestOverdue.invoice_number || largestOverdue.order_number || `AR #${largestOverdue.id}`}`
        : `Largest Overdue Reference: None`,
      largestOverdue
        ? `Largest Overdue Amount: ${formatCurrency(largestOverdue.outstanding_amount)} due ${formatDate(largestOverdue.due_date)}`
        : `Largest Overdue Amount: ${formatCurrency(0)}`,
      unpaidOrders.length > 0
        ? `Open References: ${unpaidOrders.slice(0, 5).map((entry) => entry.invoice_number || entry.order_number || `AR #${entry.id}`).join(", ")}`
        : `Open References: None`
    ].join("\n")
  ];
}



function buildProductSections({ product }) {
  const sections = [
    [
      `Product Profile`,
      `Product: ${product.name}`,
      `Product ID: ${product.id}`,
      `Category: ${product.category?.name ?? "Uncategorized"}`,
      `Status: ${product.status ? "Active" : "Inactive"}`,
      `Description: ${product.description ?? "No description available"}`
    ].join("\n")
  ];

  if (product.variants && product.variants.length > 0) {
    const variantLines = product.variants.map(v => 
      `- ${v.name || "Default"}: ${formatCurrency(v.unitPrice)} (Stock: ${v.stockQuantity})`
    );
    sections.push([
      `Variants and Pricing`,
      ...variantLines
    ].join("\n"));
  }

  return sections;
}

function buildSupplierSections({ supplier, statistics }) {
  const label = supplier.companyName || supplier.name;
  return [
    [
      `Supplier Profile`,
      `Supplier: ${label}`,
      `Supplier ID: ${supplier.id}`,
      `Contact Person: ${supplier.contactPerson ?? "N/A"}`,
      `Email: ${supplier.email ?? "N/A"}`,
      `Phone: ${supplier.phone ?? "N/A"}`,
      `Address: ${supplier.address ?? "N/A"}`,
      `Payment Terms: ${supplier.paymentTerm?.name ?? "N/A"}`
    ].join("\n"),
    [
      `Purchasing Summary`,
      `Total Orders: ${statistics.totalOrders}`,
      `Total Spent: ${formatCurrency(statistics.totalSpent)}`,
      `Total Received: ${formatCurrency(statistics.totalReceived)}`,
      `Outstanding Payable: ${formatCurrency(statistics.totalOutstanding)}`,
      `Overdue Payable: ${formatCurrency(statistics.totalOverdue)}`,
      `Last Order Date: ${formatDate(statistics.lastOrderDate)}`,
      `Last Receipt Date: ${formatDate(statistics.lastReceiptDate)}`
    ].join("\n")
  ];
}

export class AssistantIndexer {
  constructor(
    repository, 
    customersService = new CustomersService(), 
    productsService = new ProductsService(),
    sService = suppliersService,
    embeddingProvider = new AssistantEmbeddingProvider()
  ) {
    this.repository = repository;
    this.customersService = customersService;
    this.productsService = productsService;
    this.suppliersService = sService;
    this.embeddingProvider = embeddingProvider;
  }

  async reindexCustomers(tenantId, { limit = null } = {}) {
    const customers = await this.repository.listIndexableCustomers(tenantId, limit);
    let processed = 0;

    for (const customer of customers) {
      await this.reindexCustomer(tenantId, Number(customer.id));
      processed += 1;
    }

    return {
      processed,
      withEmbeddings: this.embeddingProvider.isConfigured()
    };
  }

  async reindexCustomer(tenantId, customerId) {
    const details = await this.customersService.getDetails(tenantId, customerId);
    const performanceInsight = await this.customersService.getPerformanceInsight(tenantId, customerId);
    const unpaid = await this.customersService.getUnpaidOrders(tenantId, customerId);
    const payments = await this.customersService.getPayments(tenantId, customerId, { page: 1, limit: 3 });

    const customer = details.customer;
    const statistics = details.statistics ?? {};
    const title = customer.company_name || customer.company || customer.name;
    const sections = buildCustomerSections({
      customer,
      statistics,
      performanceInsight,
      unpaidOrders: unpaid?.unpaid_orders ?? [],
      recentPayments: payments?.payments ?? []
    });
    const chunkContents = splitSectionsIntoChunks(sections);
    const embeddings = await this.embeddingProvider.embedTexts(chunkContents);
    const keywords = uniqueKeywords([
      title,
      customer.email,
      customer.phone,
      customer.payment_terms,
      ...(unpaid?.unpaid_orders ?? []).slice(0, 5).map((entry) => entry.invoice_number || entry.order_number)
    ]);

    const chunks = chunkContents.map((content, index) => ({
      chunkIndex: index,
      content,
      keywords: keywords.join(" "),
      embedding: Array.isArray(embeddings?.[index]) ? embeddings[index] : null,
      metadata: { customerId, title, sectionCount: sections.length }
    }));

    await this.repository.upsertIndexDocument({
      tenantId,
      documentKey: `customer:${customerId}`,
      sourceType: "database",
      module: "customers",
      entityType: "customer",
      entityId: customerId,
      title,
      content: sections.join("\n\n"),
      metadata: {
        customerId,
        customerName: customer.name,
        companyName: customer.company_name || customer.company || null,
        updatedAt: new Date().toISOString()
      },
      chunks
    });

    return { customerId, chunks: chunks.length };
  }

  async reindexProducts(tenantId, { limit = null } = {}) {
    const products = await this.repository.listIndexableProducts(tenantId, limit);
    let processed = 0;

    for (const product of products) {
      await this.reindexProduct(tenantId, Number(product.id));
      processed += 1;
    }

    return {
      processed,
      withEmbeddings: this.embeddingProvider.isConfigured()
    };
  }

  async reindexProduct(tenantId, productId) {
    const product = await this.productsService.getById(tenantId, productId);
    const sections = buildProductSections({ product });
    const chunkContents = splitSectionsIntoChunks(sections);
    const embeddings = await this.embeddingProvider.embedTexts(chunkContents);
    const keywords = uniqueKeywords([
      product.name,
      product.category?.name,
      ...(product.variants ?? []).map(v => v.name)
    ]);

    const chunks = chunkContents.map((content, index) => ({
      chunkIndex: index,
      content,
      keywords: keywords.join(" "),
      embedding: Array.isArray(embeddings?.[index]) ? embeddings[index] : null,
      metadata: { productId, title: product.name }
    }));

    await this.repository.upsertIndexDocument({
      tenantId,
      documentKey: `product:${productId}`,
      sourceType: "database",
      module: "products",
      entityType: "product",
      entityId: productId,
      title: product.name,
      content: sections.join("\n\n"),
      metadata: {
        productId,
        productName: product.name,
        updatedAt: new Date().toISOString()
      },
      chunks
    });

    return { productId, chunks: chunks.length };
  }

  async reindexSuppliers(tenantId, { limit = null } = {}) {
    const suppliers = await this.repository.listIndexableSuppliers(tenantId, limit);
    let processed = 0;

    for (const supplier of suppliers) {
      await this.reindexSupplier(tenantId, Number(supplier.id));
      processed += 1;
    }

    return {
      processed,
      withEmbeddings: this.embeddingProvider.isConfigured()
    };
  }

  async reindexSupplier(tenantId, supplierId) {
    const details = await this.suppliersService.getSupplierDetails(tenantId, supplierId);
    const supplier = details.data.supplier;
    const statistics = details.data.statistics;
    const title = supplier.companyName || supplier.name;
    const sections = buildSupplierSections({ supplier, statistics });
    const chunkContents = splitSectionsIntoChunks(sections);
    const embeddings = await this.embeddingProvider.embedTexts(chunkContents);
    const keywords = uniqueKeywords([
      title,
      supplier.contactPerson,
      supplier.email,
      supplier.phone
    ]);

    const chunks = chunkContents.map((content, index) => ({
      chunkIndex: index,
      content,
      keywords: keywords.join(" "),
      embedding: Array.isArray(embeddings?.[index]) ? embeddings[index] : null,
      metadata: { supplierId, title }
    }));

    await this.repository.upsertIndexDocument({
      tenantId,
      documentKey: `supplier:${supplierId}`,
      sourceType: "database",
      module: "suppliers",
      entityType: "supplier",
      entityId: supplierId,
      title,
      content: sections.join("\n\n"),
      metadata: {
        supplierId,
        supplierName: title,
        updatedAt: new Date().toISOString()
      },
      chunks
    });

    return { supplierId, chunks: chunks.length };
  }
}
