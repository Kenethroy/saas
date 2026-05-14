import mysql from "mysql2/promise";
import { env } from "#config/env";
import { logger } from "#shared/logger/index";

const TABLE_TIMESTAMP_COLUMNS = new Map([
  ["accounts_payable", { created: "created_at", updated: "updated_at" }],
  ["accounts_receivable", { created: "created_at", updated: "updated_at" }],
  ["activity_logs", { created: "created_at" }],
  ["assistant_queries", { created: "created_at" }],
  ["assistant_index_documents", { created: "created_at", updated: "updated_at" }],
  ["assistant_index_chunks", { created: "created_at", updated: "updated_at" }],
  ["business_expenses", { created: "created_at", updated: "updated_at" }],
  ["categories", { created: "created_at", updated: "updated_at" }],
  ["customer_return_items", { created: "created_at", updated: "updated_at" }],
  ["customer_returns", { created: "created_at", updated: "updated_at" }],
  ["customers", { created: "created_at", updated: "updated_at" }],
  ["deliveries", { created: "created_at", updated: "updated_at" }],
  ["delivery_sales_orders", { created: "created_at", updated: "updated_at" }],
  ["employees", { created: "created_at", updated: "updated_at" }],
  ["inventory_adjustment_items", { created: "created_at", updated: "updated_at" }],
  ["inventory_adjustments", { created: "created_at", updated: "updated_at" }],
  ["inventory_transactions", { created: "created_at", updated: "updated_at" }],
  ["invoice_items", { created: "created_at", updated: "updated_at" }],
  ["invoices", { created: "created_at", updated: "updated_at" }],
  ["payment_allocations", { created: "created_at", updated: "updated_at" }],
  ["payment_terms", { created: "created_at", updated: "updated_at" }],
  ["payments", { created: "created_at", updated: "updated_at" }],
  ["product_variants", { created: "created_at", updated: "updated_at" }],
  ["products", { created: "created_at", updated: "updated_at" }],
  ["purchase_order_items", { created: "created_at", updated: "updated_at" }],
  ["purchase_orders", { created: "created_at", updated: "updated_at" }],
  ["quotation_items", { created: "created_at", updated: "updated_at" }],
  ["quotations", { created: "created_at", updated: "updated_at" }],
  ["payslips", { created: "created_at", updated: "updated_at" }],
  ["recurring_business_expenses", { created: "created_at", updated: "updated_at" }],
  ["return_allocations", { created: "created_at", updated: "updated_at" }],
  ["role_permissions", { created: "created_at", updated: "updated_at" }],
  ["sales_order_items", { created: "created_at", updated: "updated_at" }],
  ["sales_orders", { created: "created_at", updated: "updated_at" }],
  ["settings", { created: "created_at", updated: "updated_at" }],
  ["supplier_payments", { created: "created_at", updated: "updated_at" }],
  ["suppliers", { created: "created", updated: "modified" }],
  ["trucks", { created: "created_at", updated: "updated_at" }],
  ["user_permissions", { created: "created_at", updated: "updated_at" }],
  ["user_sessions", { created: "created_at" }],
  ["users", { created: "created_at", updated: "updated_at" }]
]);

function formatAppSqlTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: env.APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const lookup = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}:${lookup.second}`;
}

function normalizeParams(params) {
  if (Array.isArray(params)) return [...params];
  if (params === undefined) return [];
  return [params];
}

function getTimestampColumns(tableName) {
  return TABLE_TIMESTAMP_COLUMNS.get(tableName.toLowerCase()) ?? null;
}

function extractTableName(sql, keyword) {
  const pattern = keyword === "INSERT"
    ? /^\s*INSERT\s+INTO\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i
    : /^\s*UPDATE\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/i;
  return sql.match(pattern)?.[1] ?? null;
}

function splitValuesGroups(valuesSql) {
  const groups = [];
  let depth = 0;
  let start = -1;

  for (let index = 0; index < valuesSql.length; index += 1) {
    const char = valuesSql[index];
    if (char === "(") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        groups.push(valuesSql.slice(start + 1, index));
        start = -1;
      }
    }
  }

  return groups;
}

function countPlaceholders(sql) {
  return (sql.match(/\?/g) ?? []).length;
}

function applyInsertTimestamps(sql, params, timestampColumns) {
  const match = sql.match(/^\s*INSERT\s+INTO\s+`?[a-zA-Z_][a-zA-Z0-9_]*`?\s*\(([\s\S]*?)\)\s*VALUES\s*([\s\S]*?)\s*;?\s*$/i);
  if (!match) {
    return { sql, params };
  }

  const columns = match[1].split(",").map((column) => column.trim().replace(/`/g, ""));
  const missingColumns = [];

  if (timestampColumns.created && !columns.includes(timestampColumns.created)) {
    missingColumns.push(timestampColumns.created);
  }

  if (timestampColumns.updated && !columns.includes(timestampColumns.updated)) {
    missingColumns.push(timestampColumns.updated);
  }

  if (!missingColumns.length) {
    return { sql, params };
  }

  const valueGroups = splitValuesGroups(match[2]);
  if (!valueGroups.length) {
    return { sql, params };
  }

  const timestamp = formatAppSqlTimestamp();
  const nextColumns = [...columns, ...missingColumns];
  const nextGroups = valueGroups.map((group) => `${group}, ${missingColumns.map(() => "?").join(", ")}`);
  const nextParams = [];
  let offset = 0;

  for (const group of valueGroups) {
    const groupParamCount = countPlaceholders(group);
    nextParams.push(...params.slice(offset, offset + groupParamCount));
    for (const _column of missingColumns) {
      nextParams.push(timestamp);
    }
    offset += groupParamCount;
  }

  const nextSql = sql.replace(
    /^\s*INSERT\s+INTO\s+(`?[a-zA-Z_][a-zA-Z0-9_]*`?)\s*\(([\s\S]*?)\)\s*VALUES\s*([\s\S]*?)\s*;?\s*$/i,
    (_full, tableToken) => `INSERT INTO ${tableToken} (${nextColumns.join(", ")}) VALUES ${nextGroups.map((group) => `(${group})`).join(", ")}`
  );

  return { sql: nextSql, params: nextParams };
}

function applyUpdateTimestamp(sql, params, timestampColumns) {
  if (!timestampColumns.updated) {
    return { sql, params };
  }

  const updatedPattern = new RegExp(`\\b${timestampColumns.updated}\\b\\s*=`, "i");
  if (updatedPattern.test(sql)) {
    return { sql, params };
  }

  const match = sql.match(/^\s*UPDATE\s+(`?[a-zA-Z_][a-zA-Z0-9_]*`?)\s+SET\s+([\s\S]*?)\s+WHERE\s+([\s\S]*?)\s*;?\s*$/i);
  if (!match) {
    return { sql, params };
  }

  const timestamp = formatAppSqlTimestamp();
  const setParamCount = countPlaceholders(match[2]);
  const nextSql = `UPDATE ${match[1]} SET ${match[2]}, ${timestampColumns.updated} = ? WHERE ${match[3]}`;
  return {
    sql: nextSql,
    params: [
      ...params.slice(0, setParamCount),
      timestamp,
      ...params.slice(setParamCount)
    ]
  };
}

function applyManagedTimestamps(sql, params) {
  if (typeof sql !== "string") {
    return { sql, params };
  }

  const normalizedParams = normalizeParams(params);
  const trimmedSql = sql.trim();

  if (/^INSERT\s+INTO/i.test(trimmedSql)) {
    const tableName = extractTableName(trimmedSql, "INSERT");
    const timestampColumns = tableName ? getTimestampColumns(tableName) : null;
    return timestampColumns
      ? applyInsertTimestamps(trimmedSql, normalizedParams, timestampColumns)
      : { sql: trimmedSql, params: normalizedParams };
  }

  if (/^UPDATE\s+/i.test(trimmedSql)) {
    const tableName = extractTableName(trimmedSql, "UPDATE");
    const timestampColumns = tableName ? getTimestampColumns(tableName) : null;
    return timestampColumns
      ? applyUpdateTimestamp(trimmedSql, normalizedParams, timestampColumns)
      : { sql: trimmedSql, params: normalizedParams };
  }

  return { sql: trimmedSql, params: normalizedParams };
}

const rawPool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  waitForConnections: true,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

function convertBigInts(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(convertBigInts);
  if (typeof obj === "object") {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = convertBigInts(obj[key]);
    }
    return newObj;
  }
  return obj;
}

// Helper to execute queries with logging
export async function query(sql, params) {
  const start = Date.now();
  try {
    const prepared = applyManagedTimestamps(sql, params);
    const [results] = await rawPool.query(prepared.sql, prepared.params);
    const duration = Date.now() - start;
    logger.debug({ sql: prepared.sql, duration }, "Database query executed");
    return convertBigInts(results);
  } catch (error) {
    logger.error({ sql, error }, "Database query failed");
    throw error;
  }
}

// Helper for transactions
export async function transaction(callback) {
  const connection = await rawPool.getConnection();
  await connection.beginTransaction();
  
  // Wrapper for connection.query to convert BigInts
  const wrappedQuery = async (sql, params) => {
    const prepared = applyManagedTimestamps(sql, params);
    const [results, fields] = await connection.query(prepared.sql, prepared.params);
    return [convertBigInts(results), fields];
  };

  try {
    const result = await callback({ 
      ...connection, 
      execute: wrappedQuery,
      query: wrappedQuery,
      originalConnection: connection 
    });
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const pool = {
  async query(sql, params) {
    const prepared = applyManagedTimestamps(sql, params);
    return rawPool.query(prepared.sql, prepared.params);
  },
  async execute(sql, params) {
    const prepared = applyManagedTimestamps(sql, params);
    return rawPool.execute(prepared.sql, prepared.params);
  },
  async getConnection() {
    return rawPool.getConnection();
  },
  async end() {
    return rawPool.end();
  }
};

export default pool;
