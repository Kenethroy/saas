import { AssistantRepository } from "#modules/assistant/assistant.repository";
import { AssistantIndexer } from "#modules/assistant/assistant.indexer";
import { ActivityLogsService } from "#modules/activity-logs/activity-logs.service";
import { CustomersService } from "#modules/customers/customers.service";
import { ProductsService } from "#modules/products/products.service";
import { suppliersService } from "#modules/suppliers/suppliers.service";
import { AssistantEmbeddingProvider } from "#shared/ai/embedding-provider";
import { AppError } from "#shared/utils/app-error";
import { buildGroundedAssistantMessages } from "#shared/ai/prompt-builder";
import { AssistantAiProvider } from "#shared/ai/provider";
import { logger } from "#shared/logger/index";

const STOP_WORDS = new Set([
  "a", "an", "and", "about", "account", "accounts", "are", "can", "customer", "customers",
  "for", "from", "give", "how", "i", "is", "me", "of", "on", "or", "please", "show",
  "status", "summary", "tell", "that", "the", "their", "this", "to", "what", "which",
  "who", "why"
]);

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

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildSource({ type, id, title, module, path }) {
  return { type, id, title, module, path };
}

function resolveCustomerDisplayName(customer) {
  return customer?.company_name || customer?.company || customer?.name || "Customer";
}

function resolveLargestAgingBucket(aging = {}) {
  const buckets = [
    { key: "days_1_30", label: "1-30 days", amount: Number(aging.days_1_30 ?? 0) },
    { key: "days_31_60", label: "31-60 days", amount: Number(aging.days_31_60 ?? 0) },
    { key: "days_61_90", label: "61-90 days", amount: Number(aging.days_61_90 ?? 0) },
    { key: "over_90", label: "over 90 days", amount: Number(aging.over_90 ?? 0) }
  ];

  return buckets.sort((left, right) => right.amount - left.amount)[0];
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeQuestion(question) {
  const normalized = normalizeText(question);
  if (!normalized) return [];

  return [...new Set(
    normalized
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
  )];
}

function scoreLexicalMatch(content, tokens, normalizedQuestion) {
  const normalizedContent = normalizeText(content);
  let score = 0;

  for (const token of tokens) {
    if (normalizedContent.includes(token)) score += 1;
  }

  if (normalizedQuestion && normalizedContent.includes(normalizedQuestion)) score += 4;

  return score;
}

function cosineSimilarity(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || left.length !== right.length) {
    return 0;
  }

  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = Number(left[index] ?? 0);
    const rightValue = Number(right[index] ?? 0);

    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function truncateText(value, maxLength = 220) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}

function looksLikeOverdueList(question) {
  const normalized = String(question ?? "").toLowerCase();
  return ["which", "who", "list", "show", "top"].some((token) => normalized.includes(token))
    && ["overdue", "past due"].some((token) => normalized.includes(token));
}

function looksLikeOutstandingList(question) {
  const normalized = String(question ?? "").toLowerCase();
  return ["which", "who", "list", "show", "top"].some((token) => normalized.includes(token))
    && ["outstanding", "unpaid", "balances"].some((token) => normalized.includes(token));
}

function looksLikeTopProductsList(question) {
  const normalized = String(question ?? "").toLowerCase();
  return ["list", "show", "top", "most", "best"].some((token) => normalized.includes(token))
    && ["product", "products", "items", "selling"].some((token) => normalized.includes(token));
}

function looksLikeTopSuppliersList(question) {
  const normalized = String(question ?? "").toLowerCase();
  return ["list", "show", "top", "most", "best"].some((token) => normalized.includes(token))
    && ["supplier", "suppliers", "vendor", "vendors"].some((token) => normalized.includes(token));
}

function looksLikeOverdueExplanation(question) {
  const normalized = String(question ?? "").toLowerCase();
  return ["why"].some((token) => normalized.includes(token))
    && ["overdue", "past due", "outstanding", "unpaid"].some((token) => normalized.includes(token));
}

function resolveSemanticCustomerId(matches = []) {
  const top = matches[0];
  if (!top?.document?.entityId || top.score < 2) return null;

  const nextDifferent = matches.find((match) => match.document?.entityId !== top.document.entityId);
  if (nextDifferent && top.score < nextDifferent.score + 0.75) return null;

  return Number(top.document.entityId);
}

export class AssistantService {
  constructor(
    repository = new AssistantRepository(),
    customersService = new CustomersService(),
    productsService = new ProductsService(),
    sService = suppliersService,
    aiProvider = new AssistantAiProvider(),
    embeddingProvider = new AssistantEmbeddingProvider()
  ) {
    this.repository = repository;
    this.customersService = customersService;
    this.productsService = productsService;
    this.suppliersService = sService;
    this.aiProvider = aiProvider;
    this.embeddingProvider = embeddingProvider;
    this.indexer = new AssistantIndexer(
      repository,
      customersService,
      productsService,
      sService,
      embeddingProvider
    );
    this.activityLogs = new ActivityLogsService();
  }

  async query({ question, context = {}, user = null, ipAddress = null, userAgent = null }) {
    const customerId = context.customerId ? Number(context.customerId) : null;

    try {
      let response;
      const semanticMatches = await this.safeRetrieveSemanticMatches(question, {
        customerId
      });

      if (customerId) {
        response = await this.buildCustomerAnswer(customerId, question, {
          semanticMatches
        });
      } else if (looksLikeOverdueList(question)) {
        response = await this.buildOverdueListAnswer();
      } else if (looksLikeOutstandingList(question)) {
        response = await this.buildOutstandingListAnswer();
      } else if (looksLikeTopProductsList(question)) {
        response = await this.buildTopProductsListAnswer();
      } else if (looksLikeTopSuppliersList(question)) {
        response = await this.buildTopSuppliersListAnswer();
      } else {
        const matches = await this.repository.findCustomerMatches(question, 5);
        const topSemantic = semanticMatches[0];
        const semanticEntityId = topSemantic?.document?.entityId;
        const semanticEntityType = topSemantic?.document?.entityType;

        if (matches.length === 1 || (matches.length > 1 && (matches[0].score ?? 0) >= ((matches[1]?.score ?? 0) + 3))) {
          response = await this.buildCustomerAnswer(matches[0].id, question, {
            semanticMatches
          });
        } else if (semanticEntityType === "product" && semanticEntityId) {
          response = await this.buildProductAnswer(semanticEntityId, question, { semanticMatches });
        } else if (semanticEntityType === "supplier" && semanticEntityId) {
          response = await this.buildSupplierAnswer(semanticEntityId, question, { semanticMatches });
        } else if (semanticEntityType === "customer" && semanticEntityId) {
          response = await this.buildCustomerAnswer(semanticEntityId, question, { semanticMatches });
        } else {
          response = {
            mode: "deterministic",
            confidence: "low",
            intent: "needs_clarification",
            answer: "I can help with customers, products, or suppliers. Ask about a specific item, or request summaries like 'Show overdue customers' or 'List top products'.",
            sources: semanticMatches.map((match) => buildSource({
              type: match.document.entityType,
              id: Number(match.document.entityId),
              title: match.document.title,
              module: match.document.module,
              path: `/${match.document.module}/${Number(match.document.entityId)}`
            })),
            suggestions: [
              "Which customers are overdue right now?",
              "Show me our top products",
              "Summarize our relationship with a supplier"
            ],
            grounding: {
              facts: semanticMatches.map((match) => ({
                entityId: Number(match.document.entityId),
                type: match.document.entityType,
                title: match.document.title,
                score: match.score,
                preview: match.preview
              })),
              notes: ["No direct match could be resolved from the submitted question."]
            }
          };
        }
      }

      const finalized = await this.maybeUpgradeWithAi(question, response);

      await this.safePersistQuery({
        userId: user?.id ?? null,
        question,
        answer: finalized.answer,
        mode: finalized.mode,
        confidence: finalized.confidence,
        intent: finalized.intent,
        status: "success",
        provider: finalized.provider ?? null,
        model: finalized.model ?? null,
        context,
        sources: finalized.sources ?? [],
        ipAddress,
        userAgent
      });

      await this.safeWriteActivityLog({
        userId: user?.id ?? null,
        action: "ASSISTANT_QUERY",
        module: "ASSISTANT",
        description: `Assistant query processed: ${question.slice(0, 120)}`,
        ipAddress,
        userAgent,
        metadata: {
          mode: finalized.mode,
          intent: finalized.intent,
          confidence: finalized.confidence,
          provider: finalized.provider ?? null,
          model: finalized.model ?? null
        }
      });

      return finalized;
    } catch (error) {
      await this.safePersistQuery({
        userId: user?.id ?? null,
        question,
        answer: null,
        mode: "failed",
        confidence: null,
        intent: null,
        status: "error",
        provider: null,
        model: null,
        context,
        sources: [],
        ipAddress,
        userAgent,
        errorMessage: error.message
      });

      throw error;
    }
  }

  async reindex({ scope = ["customers"], limit = null, user = null, ipAddress = null, userAgent = null }) {
    const normalizedScope = Array.isArray(scope) && scope.length > 0 ? scope : ["customers"];
    const result = {
      scope: normalizedScope,
      processedCustomers: 0,
      withEmbeddings: this.embeddingProvider.isConfigured(),
      indexStats: { documents: 0, chunks: 0 }
    };

    if (normalizedScope.includes("customers")) {
      const indexed = await this.indexer.reindexCustomers({ limit });
      result.processedCustomers = indexed.processed;
      result.withEmbeddings = indexed.withEmbeddings;
    }

    if (normalizedScope.includes("products")) {
      const indexed = await this.indexer.reindexProducts({ limit });
      result.processedProducts = indexed.processed;
    }

    if (normalizedScope.includes("suppliers")) {
      const indexed = await this.indexer.reindexSuppliers({ limit });
      result.processedSuppliers = indexed.processed;
    }

    result.indexStats = await this.safeGetIndexStats();

    await this.safeWriteActivityLog({
      userId: user?.id ?? null,
      action: "ASSISTANT_REINDEX",
      module: "ASSISTANT",
      description: `Assistant reindex completed for scope: ${normalizedScope.join(", ")}`,
      ipAddress,
      userAgent,
      metadata: result
    });

    return result;
  }

  async getStatus() {
    const indexStats = await this.safeGetIndexStats();

    return {
      ai: {
        chatConfigured: this.aiProvider.isConfigured(),
        chatProvider: this.aiProvider.getConfiguration().provider,
        chatModel: this.aiProvider.getConfiguration().model ?? null,
        embeddingsConfigured: this.embeddingProvider.isConfigured(),
        embeddingProvider: this.embeddingProvider.getConfiguration().provider,
        embeddingModel: this.embeddingProvider.getConfiguration().model ?? null
      },
      indexStats
    };
  }

  async maybeUpgradeWithAi(question, response) {
    const grounding = response.grounding ?? { facts: [], notes: [] };

    const aiResult = await this.aiProvider.generateText({
      messages: buildGroundedAssistantMessages({
        question,
        grounding: {
          draftAnswer: response.answer,
          facts: grounding.facts ?? [],
          sources: response.sources ?? [],
          notes: grounding.notes ?? []
        }
      })
    });

    if (!aiResult) return { ...response, provider: null, model: null };

    return {
      ...response,
      answer: aiResult.text,
      mode: response.mode === "deterministic" ? "ai_grounded" : response.mode,
      provider: aiResult.provider,
      model: aiResult.model
    };
  }

  async safePersistQuery(data) {
    try {
      await this.repository.createQueryLog(data);
    } catch (error) {
      logger.warn({ err: error }, "Assistant query audit persistence failed");
    }
  }

  async safeWriteActivityLog(data) {
    try {
      await this.activityLogs.log(data);
    } catch (error) {
      logger.warn({ err: error }, "Assistant activity log write failed");
    }
  }

  async safeRetrieveSemanticMatches(question, { customerId = null } = {}) {
    try {
      return await this.retrieveSemanticMatches(question, { customerId });
    } catch (error) {
      logger.warn({ err: error }, "Assistant semantic retrieval failed");
      return [];
    }
  }

  async retrieveSemanticMatches(question, { customerId = null } = {}) {
    const tokens = tokenizeQuestion(question);
    const embeddings = await this.embeddingProvider.embedTexts([question]);
    const queryEmbedding = Array.isArray(embeddings?.[0]) ? embeddings[0] : null;

    if (tokens.length === 0 && !queryEmbedding) return [];

    const rows = await this.repository.fetchRelevantChunks({
      entityId: customerId,
      entityType: customerId ? "customer" : null,
      tokens,
      limit: customerId != null ? 80 : (queryEmbedding ? 180 : 100)
    });

    const normalizedQuestion = normalizeText(question);

    return rows
      .map((row) => {
        const lexical = scoreLexicalMatch(`${row.content} ${row.keywords ?? ""}`, tokens, normalizedQuestion);
        const semantic = queryEmbedding && Array.isArray(row.embedding)
          ? cosineSimilarity(queryEmbedding, row.embedding) * 10
          : 0;
        const score = lexical + semantic;

        return {
          chunkId: Number(row.id),
          score,
          preview: truncateText(row.content),
          content: row.content,
          document: {
            id: Number(row.document.id),
            module: row.document.module,
            entityType: row.document.entityType,
            entityId: row.document.entityId != null ? Number(row.document.entityId) : null,
            title: row.document.title,
            documentKey: row.document.documentKey,
            lastIndexedAt: row.document.lastIndexedAt
          }
        };
      })
      .filter((row) => row.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);
  }

  async safeGetIndexStats() {
    try {
      return await this.repository.getIndexStats();
    } catch (error) {
      logger.warn({ err: error }, "Assistant index stats retrieval failed");
      return { documents: 0, chunks: 0 };
    }
  }

  async buildOverdueListAnswer() {
    const rows = await this.repository.listOverdueCustomers(5);

    if (rows.length === 0) {
      return {
        mode: "deterministic",
        confidence: "high",
        intent: "overdue_customer_list",
        answer: "There are no overdue customer receivables in the current dataset.",
        sources: [],
        suggestions: ["Which customers have the largest outstanding balances?", "Summarize a customer's account health"],
        grounding: { facts: [], notes: ["No overdue customer receivables were found."] }
      };
    }

    const lines = rows.map((row, index) => {
      const label = row.company || row.name;
      const invoiceSummary = row.invoices.length > 0 ? ` Sample invoices: ${row.invoices.join(", ")}.` : "";
      return `${index + 1}. ${label} has ${formatCurrency(row.overdueAmount)} overdue across ${pluralize(row.overdueCount, "item")}. Oldest due date: ${formatDate(row.oldestDueDate)}.${invoiceSummary}`;
    });

    return {
      mode: "deterministic",
      confidence: "high",
      intent: "overdue_customer_list",
      answer: `Top overdue customers right now:\n${lines.join("\n")}`,
      sources: rows.map((row) => buildSource({
        type: "customer", id: row.customerId, title: row.company || row.name, module: "customers", path: `/customers/${row.customerId}`
      })),
      suggestions: rows.slice(0, 3).map((row) => `Why is ${row.company || row.name} overdue?`),
      grounding: {
        facts: rows.map((row) => ({
          customerId: row.customerId, customerName: row.company || row.name, overdueAmount: row.overdueAmount,
          overdueCount: row.overdueCount, oldestDueDate: row.oldestDueDate, invoices: row.invoices
        })),
        notes: ["This answer was assembled from overdue accounts receivable records."]
      }
    };
  }

  async buildOutstandingListAnswer() {
    const rows = await this.repository.listOutstandingCustomers(5);

    if (rows.length === 0) {
      return {
        mode: "deterministic",
        confidence: "high",
        intent: "outstanding_customer_list",
        answer: "There are no outstanding customer balances in the current dataset.",
        sources: [],
        suggestions: ["Which customers are overdue right now?", "Summarize a customer's account health"],
        grounding: { facts: [], notes: ["No outstanding customer balances were found."] }
      };
    }

    const lines = rows.map((row, index) => {
      const label = row.company || row.name;
      const invoiceSummary = row.invoices.length > 0 ? ` Sample invoices: ${row.invoices.join(", ")}.` : "";
      return `${index + 1}. ${label} has an outstanding balance of ${formatCurrency(row.outstandingAmount)} across ${pluralize(row.outstandingCount, "item")}.${invoiceSummary}`;
    });

    return {
      mode: "deterministic",
      confidence: "high",
      intent: "outstanding_customer_list",
      answer: `Customers with the largest outstanding balances:\n${lines.join("\n")}`,
      sources: rows.map((row) => buildSource({
        type: "customer", id: row.customerId, title: row.company || row.name, module: "customers", path: `/customers/${row.customerId}`
      })),
      suggestions: rows.slice(0, 3).map((row) => `Summarize ${row.company || row.name}'s account health`),
      grounding: {
        facts: rows.map((row) => ({
          customerId: row.customerId, customerName: row.company || row.name, outstandingAmount: row.outstandingAmount,
          outstandingCount: row.outstandingCount, oldestDueDate: row.oldestDueDate, invoices: row.invoices
        })),
        notes: ["This answer was assembled from all unpaid or partially paid accounts receivable records."]
      }
    };
  }

  async buildCustomerAnswer(customerId, question, { semanticMatches = [] } = {}) {
    const details = await this.customersService.getDetails(customerId);
    const unpaid = await this.customersService.getUnpaidOrders(customerId);
    const payments = await this.customersService.getPayments(customerId, { page: 1, limit: 3 });
    const performanceInsight = await this.customersService.getPerformanceInsight(customerId);

    if (!details?.customer) throw new AppError("Customer context could not be resolved", 404);

    const customer = details.customer;
    const statistics = details.statistics ?? {};
    const customerLabel = resolveCustomerDisplayName(customer);
    const latestPayment = payments?.payments?.[0] ?? null;
    const topSemanticChunk = semanticMatches.find((match) => Number(match.document?.entityId) === Number(customerId)) ?? null;
    const topOverdueOrder = [...(unpaid?.unpaid_orders ?? [])]
      .filter((entry) => entry.is_overdue)
      .sort((left, right) => right.outstanding_amount - left.outstanding_amount)[0] ?? null;
    const agingBucket = resolveLargestAgingBucket(statistics.aging);

    const answerParts = [];

    if (looksLikeOverdueExplanation(question)) {
      if (Number(statistics.total_overdue ?? 0) > 0) {
        answerParts.push(`${customerLabel} is overdue because ${formatCurrency(statistics.total_overdue)} is already past due across ${pluralize(Number(statistics.overdue_orders_count ?? 0), "receivable item")}.`);
        if (agingBucket?.amount > 0) answerParts.push(`The largest aging bucket is ${agingBucket.label} at ${formatCurrency(agingBucket.amount)}.`);
        if (topOverdueOrder) answerParts.push(`The highest overdue exposure is ${topOverdueOrder.invoice_number || topOverdueOrder.order_number || "an open invoice"} with ${formatCurrency(topOverdueOrder.outstanding_amount)} due since ${formatDate(topOverdueOrder.due_date)}.`);
      } else {
        answerParts.push(`${customerLabel} does not currently have overdue receivables.`);
      }
    } else {
      answerParts.push(performanceInsight);
      answerParts.push(`Current receivable exposure is ${formatCurrency(statistics.total_outstanding ?? 0)}, with ${formatCurrency(statistics.total_overdue ?? 0)} overdue across ${pluralize(Number(statistics.overdue_orders_count ?? 0), "item")}.`);
    }

    if (latestPayment) {
      answerParts.push(`The latest recorded payment was ${latestPayment.payment_number} on ${formatDate(latestPayment.date)} for ${formatCurrency(latestPayment.amount)}.`);
    } else {
      answerParts.push("No customer payment history is currently recorded.");
    }

    return {
      mode: "deterministic",
      confidence: Number(statistics.total_orders ?? 0) > 0 ? "high" : "medium",
      intent: looksLikeOverdueExplanation(question) ? "customer_overdue_explanation" : "customer_account_summary",
      answer: answerParts.join(" "),
      sources: [
        buildSource({ type: "customer", id: Number(customer.id), title: customerLabel, module: "customers", path: `/customers/${customer.id}` }),
        ...(topOverdueOrder ? [buildSource({ type: "accounts_receivable", id: topOverdueOrder.id, title: topOverdueOrder.invoice_number || topOverdueOrder.order_number || `AR #${topOverdueOrder.id}`, module: "accounts-receivable", path: "/accounts-receivable" })] : []),
        ...(latestPayment ? [buildSource({ type: "payment", id: Number(latestPayment.id), title: latestPayment.payment_number, module: "payments", path: "/customer-collections" })] : [])
      ],
      suggestions: [`Why is ${customerLabel} overdue?`, `Summarize ${customerLabel}'s account health`, `Which customers are overdue right now?`],
      context: { customerId: Number(customer.id), customerName: customerLabel },
      grounding: {
        facts: [
          { customerId: Number(customer.id), customerName: customerLabel, totalOrders: Number(statistics.total_orders ?? 0), totalSpent: Number(statistics.total_spent ?? 0), totalOutstanding: Number(statistics.total_outstanding ?? 0), totalOverdue: Number(statistics.total_overdue ?? 0), overdueOrdersCount: Number(statistics.overdue_orders_count ?? 0) },
          ...(agingBucket?.amount > 0 ? [{ agingBucket: agingBucket.label, agingBucketAmount: agingBucket.amount }] : []),
          ...(topOverdueOrder ? [{ topOverdueReference: topOverdueOrder.invoice_number || topOverdueOrder.order_number || `AR #${topOverdueOrder.id}`, topOverdueAmount: topOverdueOrder.outstanding_amount, topOverdueDueDate: topOverdueOrder.due_date }] : []),
          ...(latestPayment ? [{ latestPaymentNumber: latestPayment.payment_number, latestPaymentDate: latestPayment.date, latestPaymentAmount: latestPayment.amount }] : []),
          ...(topSemanticChunk ? [{ indexedChunkPreview: topSemanticChunk.preview, indexedChunkScore: topSemanticChunk.score }] : [])
        ],
        notes: ["This answer was composed from customer detail, unpaid order, payment, and performance insight service outputs.", ...(topSemanticChunk ? [`Indexed customer summary match: ${topSemanticChunk.preview}`] : [])]
      }
    };
  }

  async buildProductAnswer(productId, question, { semanticMatches = [] } = {}) {
    const product = await this.productsService.getById(productId);
    const topSemantic = semanticMatches.find(m => Number(m.document?.entityId) === Number(productId)) ?? null;

    const variantLines = (product.variants ?? []).map(v => 
      `- ${v.name || "Standard"}: ${formatCurrency(v.unitPrice)} (Stock: ${v.stockQuantity})`
    ).join("\n");

    const answer = [
      `Product: ${product.name}`,
      `Category: ${product.category?.name ?? "Uncategorized"}`,
      `Status: ${product.status ? "Active" : "Inactive"}`,
      product.description ? `Description: ${product.description}` : null,
      "\nAvailable Variants:",
      variantLines
    ].filter(Boolean).join("\n");

    return {
      mode: "deterministic",
      confidence: "high",
      intent: "product_summary",
      answer,
      sources: [
        buildSource({ type: "product", id: product.id, title: product.name, module: "products", path: `/products/${product.id}` })
      ],
      suggestions: ["Show me more products in this category", "Who is the supplier for this product?"],
      grounding: {
        facts: [{ productId: product.id, name: product.name, variantCount: product.variants?.length }],
        notes: ["Product data retrieved from inventory records."]
      }
    };
  }

  async buildSupplierAnswer(supplierId, question, { semanticMatches = [] } = {}) {
    const details = await this.suppliersService.getSupplierDetails(supplierId);
    const supplier = details.data.supplier;
    const stats = details.data.statistics;
    const label = supplier.companyName || supplier.name;

    const answer = [
      `Supplier: ${label}`,
      `Contact: ${supplier.contactPerson ?? "N/A"} (${supplier.email ?? "N/A"})`,
      `Total Orders: ${stats.totalOrders}`,
      `Total Spent: ${formatCurrency(stats.totalSpent)}`,
      `Outstanding Payable: ${formatCurrency(stats.totalOutstanding)}`,
      stats.totalOverdue > 0 ? `Overdue Payable: ${formatCurrency(stats.totalOverdue)}` : "No overdue payables."
    ].join("\n");

    return {
      mode: "deterministic",
      confidence: "high",
      intent: "supplier_summary",
      answer,
      sources: [
        buildSource({ type: "supplier", id: supplier.id, title: label, module: "suppliers", path: `/suppliers/${supplier.id}` })
      ],
      suggestions: [`List recent orders from ${label}`, `Show payables for ${label}`],
      grounding: {
        facts: [{ supplierId: supplier.id, name: label, totalOrders: stats.totalOrders, totalOutstanding: stats.totalOutstanding }],
        notes: ["Supplier data retrieved from accounts payable and purchasing records."]
      }
    };
  }

  async buildTopProductsListAnswer() {
    const products = await this.repository.fetchTopProducts(5);

    if (products.length === 0) {
      return {
        mode: "deterministic",
        confidence: "high",
        intent: "top_products_list",
        answer: "There are no product sales recorded in the current dataset to determine top products.",
        sources: [],
        suggestions: ["Which customers are overdue right now?", "Show me all products"],
        grounding: { facts: [], notes: ["No sales order items were found."] }
      };
    }

    const lines = products.map((p, index) => {
      return `${index + 1}. ${p.productName} (${p.categoryName ?? "Uncategorized"}): ${p.totalQuantity} units sold across ${pluralize(p.orderCount, "order")}. Total revenue: ${formatCurrency(p.totalRevenue)}.`;
    });

    return {
      mode: "deterministic",
      confidence: "high",
      intent: "top_products_list",
      answer: `Our top-selling products based on quantity sold:\n${lines.join("\n")}`,
      sources: products.map((p) => buildSource({
        type: "product", id: p.productId, title: p.productName, module: "products", path: `/products/${p.productId}`
      })),
      suggestions: products.slice(0, 3).map((p) => `Summarize product: ${p.productName}`),
      grounding: {
        facts: products.map((p) => ({
          productId: p.productId, productName: p.productName, totalQuantity: p.totalQuantity,
          totalRevenue: p.totalRevenue, orderCount: p.orderCount
        })),
        notes: ["This answer was assembled by aggregating sales order items grouped by product."]
      }
    };
  }

  async buildTopSuppliersListAnswer() {
    const suppliers = await this.repository.fetchTopSuppliers(5);

    if (suppliers.length === 0) {
      return {
        mode: "deterministic",
        confidence: "high",
        intent: "top_suppliers_list",
        answer: "There are no purchase records in the current dataset to determine top suppliers.",
        sources: [],
        suggestions: ["Which customers are overdue right now?", "Show me all suppliers"],
        grounding: { facts: [], notes: ["No purchase orders were found."] }
      };
    }

    const lines = suppliers.map((s, index) => {
      const label = s.companyName || s.name;
      return `${index + 1}. ${label}: ${formatCurrency(s.totalSpent)} spent across ${pluralize(s.orderCount, "purchase order")}. Last order: ${formatDate(s.lastOrderDate)}.`;
    });

    return {
      mode: "deterministic",
      confidence: "high",
      intent: "top_suppliers_list",
      answer: `Suppliers with our highest purchasing volume:\n${lines.join("\n")}`,
      sources: suppliers.map((s) => buildSource({
        type: "supplier", id: s.supplierId, title: s.companyName || s.name, module: "suppliers", path: `/suppliers/${s.supplierId}`
      })),
      suggestions: suppliers.slice(0, 3).map((s) => `Summarize supplier: ${s.companyName || s.name}`),
      grounding: {
        facts: suppliers.map((s) => ({
          supplierId: s.supplierId, name: s.name, totalSpent: s.totalSpent, orderCount: s.orderCount, lastOrderDate: s.lastOrderDate
        })),
        notes: ["This answer was assembled by aggregating purchase orders grouped by supplier."]
      }
    };
  }
}
