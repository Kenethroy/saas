import { query } from "#shared/database/mysql";

const STOP_WORDS = new Set([
  "a", "an", "and", "about", "account", "accounts", "are", "can", "customer", "customers",
  "for", "from", "give", "how", "i", "is", "me", "of", "on", "or", "please", "show",
  "status", "summary", "tell", "that", "the", "their", "this", "to", "what", "which",
  "who", "why"
]);

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

function scoreCustomer(row, normalizedQuestion, tokens) {
  const combined = normalizeText([row.name, row.company].filter(Boolean).join(" "));
  const tokenHits = tokens.reduce((score, token) => (
    combined.includes(token) ? score + 2 : score
  ), 0);

  let score = tokenHits;

  if (combined && normalizedQuestion.includes(combined)) {
    score += 12;
  }

  if (normalizeText(row.name) && normalizedQuestion.includes(normalizeText(row.name))) {
    score += 8;
  }

  if (normalizeText(row.company) && normalizedQuestion.includes(normalizeText(row.company))) {
    score += 6;
  }

  if (combined.startsWith(tokens[0] ?? "")) {
    score += 2;
  }

  return score;
}

export class AssistantRepository {
  async findCustomerMatches(question, limit = 5) {
    const tokens = tokenizeQuestion(question);
    if (tokens.length === 0) return [];

    let sql = "SELECT id, name, company, status FROM customers WHERE delete_flg = 0 AND (";
    const conditions = [];
    const params = [];

    for (const token of tokens) {
      conditions.push("name LIKE ? OR company LIKE ?");
      params.push(`%${token}%`, `%${token}%`);
    }

    sql += conditions.join(" OR ") + ") LIMIT 25";

    const rows = await query(sql, params);
    const normalizedQuestion = normalizeText(question);

    return rows
      .map((row) => ({
        id: Number(row.id),
        name: row.name,
        company: row.company,
        status: row.status === 1,
        score: scoreCustomer(row, normalizedQuestion, tokens)
      }))
      .filter((row) => row.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.name.localeCompare(right.name);
      })
      .slice(0, limit);
  }

  async listOverdueCustomers(limit = 5, referenceDate = new Date()) {
    const sql = `
      SELECT ar.id, ar.due_date, ar.outstanding_amount, 
             c.id AS customer_id, c.name, c.company,
             inv.invoice_number
      FROM accounts_receivable ar
      LEFT JOIN customers c ON ar.customer_id = c.id
      LEFT JOIN invoices inv ON ar.invoice_id = inv.id
      WHERE ar.delete_flg = 0 
        AND ar.status IN ('unpaid', 'partial')
        AND ar.due_date < ?
      ORDER BY ar.due_date ASC, ar.id ASC
      LIMIT 250
    `;
    
    const rows = await query(sql, [referenceDate]);
    const grouped = new Map();

    for (const row of rows) {
      if (!row.customer_id) continue;

      const customerId = Number(row.customer_id);
      const existing = grouped.get(customerId) ?? {
        customerId,
        name: row.name,
        company: row.company,
        overdueAmount: 0,
        overdueCount: 0,
        oldestDueDate: row.due_date ?? null,
        invoices: []
      };

      existing.overdueAmount += Number(row.outstanding_amount);
      existing.overdueCount += 1;

      if (row.due_date && (!existing.oldestDueDate || new Date(row.due_date) < new Date(existing.oldestDueDate))) {
        existing.oldestDueDate = row.due_date;
      }

      if (row.invoice_number && existing.invoices.length < 3) {
        existing.invoices.push(row.invoice_number);
      }

      grouped.set(customerId, existing);
    }

    return [...grouped.values()]
      .sort((left, right) => {
        if (right.overdueAmount !== left.overdueAmount) return right.overdueAmount - left.overdueAmount;
        return right.overdueCount - left.overdueCount;
      })
      .slice(0, limit);
  }

  async listOutstandingCustomers(limit = 5) {
    const sql = `
      SELECT ar.id, ar.due_date, ar.outstanding_amount, 
             c.id AS customer_id, c.name, c.company,
             inv.invoice_number
      FROM accounts_receivable ar
      LEFT JOIN customers c ON ar.customer_id = c.id
      LEFT JOIN invoices inv ON ar.invoice_id = inv.id
      WHERE ar.delete_flg = 0 
        AND ar.status IN ('unpaid', 'partial')
      ORDER BY ar.due_date ASC, ar.id ASC
      LIMIT 250
    `;
    
    const rows = await query(sql);
    const grouped = new Map();

    for (const row of rows) {
      if (!row.customer_id) continue;

      const customerId = Number(row.customer_id);
      const existing = grouped.get(customerId) ?? {
        customerId,
        name: row.name,
        company: row.company,
        outstandingAmount: 0,
        outstandingCount: 0,
        oldestDueDate: row.due_date ?? null,
        invoices: []
      };

      existing.outstandingAmount += Number(row.outstanding_amount);
      existing.outstandingCount += 1;

      if (row.due_date && (!existing.oldestDueDate || new Date(row.due_date) < new Date(existing.oldestDueDate))) {
        existing.oldestDueDate = row.due_date;
      }

      if (row.invoice_number && existing.invoices.length < 3) {
        existing.invoices.push(row.invoice_number);
      }

      grouped.set(customerId, existing);
    }

    return [...grouped.values()]
      .sort((left, right) => {
        if (right.outstandingAmount !== left.outstandingAmount) return right.outstandingAmount - left.outstandingAmount;
        return right.outstandingCount - left.outstandingCount;
      })
      .slice(0, limit);
  }

  async createQueryLog(data) {
    const sql = `
      INSERT INTO assistant_queries (
        user_id, question, answer, mode, confidence, intent, status,
        provider, model, context, sources, error_message, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return query(sql, [
      data.userId || null, data.question, data.answer || null, data.mode,
      data.confidence || null, data.intent || null, data.status || 'success',
      data.provider || null, data.model || null,
      data.context ? JSON.stringify(data.context) : null,
      data.sources ? JSON.stringify(data.sources) : null,
      data.errorMessage || null, data.ipAddress || null, data.userAgent || null
    ]);
  }

  async listIndexableCustomers(limit = null) {
    let sql = "SELECT id, name, company, updated_at FROM customers WHERE delete_flg = 0 ORDER BY id ASC";
    if (limit) sql += ` LIMIT ${Number(limit)}`;
    return query(sql);
  }

  async listIndexableProducts(limit = null) {
    let sql = "SELECT id, name, updated_at FROM products WHERE delete_flg = 0 ORDER BY id ASC";
    if (limit) sql += ` LIMIT ${Number(limit)}`;
    return query(sql);
  }

  async listIndexableSuppliers(limit = null) {
    let sql = "SELECT id, name, modified as updated_at FROM suppliers WHERE delete_flg = 0 ORDER BY id ASC";
    if (limit) sql += ` LIMIT ${Number(limit)}`;
    return query(sql);
  }

  async fetchTopProducts(limit = 5) {
    const sql = `
      SELECT 
        soi.product_id, 
        soi.product_name,
        p.category_id,
        c.name as category_name,
        SUM(soi.quantity) as total_quantity,
        SUM(soi.line_total) as total_revenue,
        COUNT(DISTINCT soi.sales_order_id) as order_count
      FROM sales_order_items soi
      JOIN products p ON soi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      JOIN sales_orders so ON soi.sales_order_id = so.id
      WHERE p.delete_flg = 0 AND so.delete_flg = 0 AND so.status <> 'cancelled'
      GROUP BY soi.product_id, soi.product_name, p.category_id, c.name
      ORDER BY total_quantity DESC
      LIMIT ?
    `;
    const rows = await query(sql, [limit]);
    return rows.map(r => ({
      productId: Number(r.product_id),
      productName: r.product_name,
      categoryId: r.category_id ? Number(r.category_id) : null,
      categoryName: r.category_name,
      totalQuantity: Number(r.total_quantity),
      totalRevenue: Number(r.total_revenue),
      orderCount: Number(r.order_count)
    }));
  }

  async fetchTopSuppliers(limit = 5) {
    const sql = `
      SELECT 
        s.id as supplier_id,
        s.name,
        s.company_name,
        SUM(po.total_amount) as total_spent,
        COUNT(po.id) as order_count,
        MAX(po.order_date) as last_order_date
      FROM suppliers s
      JOIN purchase_orders po ON s.id = po.supplier_id
      WHERE s.delete_flg = 0 AND po.delete_flg = 0 AND po.status <> 'cancelled'
      GROUP BY s.id, s.name, s.company_name
      ORDER BY total_spent DESC
      LIMIT ?
    `;
    const rows = await query(sql, [limit]);
    return rows.map(r => ({
      supplierId: Number(r.supplier_id),
      name: r.name,
      companyName: r.company_name,
      totalSpent: Number(r.total_spent),
      orderCount: Number(r.order_count),
      lastOrderDate: r.last_order_date
    }));
  }

  async upsertIndexDocument({ documentKey, sourceType, module, entityType, entityId = null, title, content, metadata = null, chunks = [] }) {
    const { transaction } = await import("#shared/database/mysql");
    return transaction(async (tx) => {
      const [existingRows] = await tx.query("SELECT id FROM assistant_index_documents WHERE document_key = ? LIMIT 1", [documentKey]);
      const existingId = existingRows[0]?.id;

      let docId;
      if (existingId) {
        docId = existingId;
        await tx.query(`
          UPDATE assistant_index_documents 
          SET source_type = ?, module = ?, entity_type = ?, entity_id = ?, 
              title = ?, content = ?, metadata = ?, last_indexed_at = NOW()
          WHERE id = ?
        `, [sourceType, module, entityType, entityId, title, content, metadata ? JSON.stringify(metadata) : null, docId]);
        
        await tx.query("DELETE FROM assistant_index_chunks WHERE document_id = ?", [docId]);
      } else {
        const [result] = await tx.query(`
          INSERT INTO assistant_index_documents (
            document_key, source_type, module, entity_type, entity_id, title, content, metadata, last_indexed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [documentKey, sourceType, module, entityType, entityId, title, content, metadata ? JSON.stringify(metadata) : null]);
        docId = result.insertId;
      }

      if (chunks.length > 0) {
        const chunkSql = `
          INSERT INTO assistant_index_chunks (
            document_id, chunk_index, content, keywords, embedding, metadata
          ) VALUES ?
        `;
        const chunkValues = chunks.map(chunk => [
          docId, chunk.chunkIndex, chunk.content, chunk.keywords || null,
          chunk.embedding ? JSON.stringify(chunk.embedding) : null,
          chunk.metadata ? JSON.stringify(chunk.metadata) : null
        ]);
        await tx.query(chunkSql, [chunkValues]);
      }

      return docId;
    });
  }

  async fetchRelevantChunks({ module = null, entityType = null, entityId = null, tokens = [], limit = 120 }) {
    let sql = `
      SELECT c.*, 
             d.module, d.entity_type, d.entity_id, d.title, d.document_key, d.metadata as doc_metadata, d.last_indexed_at
      FROM assistant_index_chunks c
      JOIN assistant_index_documents d ON c.document_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (module) {
      sql += " AND d.module = ?";
      params.push(module);
    }

    if (entityType) {
      sql += " AND d.entity_type = ?";
      params.push(entityType);
    }

    if (entityId != null) {
      sql += " AND d.entity_id = ?";
      params.push(entityId);
    } else if (tokens.length > 0) {
      sql += " AND (";
      const conditions = [];
      for (const token of tokens) {
        conditions.push("c.content LIKE ? OR c.keywords LIKE ?");
        params.push(`%${token}%`, `%${token}%`);
      }
      sql += conditions.join(" OR ") + ")";
    }

    sql += " ORDER BY d.id ASC, c.chunk_index ASC LIMIT ?";
    params.push(limit);

    const rows = await query(sql, params);
    return rows.map(r => ({
      id: r.id,
      content: r.content,
      keywords: r.keywords,
      embedding: r.embedding ? (typeof r.embedding === 'string' ? JSON.parse(r.embedding) : r.embedding) : null,
      document: {
        id: r.document_id,
        module: r.module,
        entityType: r.entity_type,
        entityId: r.entity_id,
        title: r.title,
        documentKey: r.document_key,
        lastIndexedAt: r.last_indexed_at
      }
    }));
  }

  async getIndexStats() {
    const [docCount, chunkCount] = await Promise.all([
      query("SELECT COUNT(*) as count FROM assistant_index_documents"),
      query("SELECT COUNT(*) as count FROM assistant_index_chunks")
    ]);

    return {
      documents: docCount[0].count,
      chunks: chunkCount[0].count
    };
  }
}
