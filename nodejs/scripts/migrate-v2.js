import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function splitSqlStatements(sql) {
  return sql
    .split(/;\s*\n/g)
    .map((statement) => statement.trim())
    .filter(Boolean)
    .map((statement) => `${statement};`);
}

function compactSqlPreview(sql) {
  return sql.replace(/\s+/g, " ").slice(0, 220);
}

function parseSqlFile(sql) {
  const lines = sql.split("\n");
  const statements = [];
  let delimiter = ";";
  let buffer = "";

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      buffer += `${rawLine}\n`;
      continue;
    }

    if (trimmed.startsWith("--")) {
      buffer += `${rawLine}\n`;
      continue;
    }

    const delimiterMatch = trimmed.match(/^DELIMITER\s+(.+)$/i);
    if (delimiterMatch) {
      delimiter = delimiterMatch[1];
      continue;
    }

    buffer += `${rawLine}\n`;

    if (trimmed.endsWith(delimiter)) {
      const statement = buffer.trimEnd().slice(0, -delimiter.length).trim();

      if (statement) {
        statements.push(`${statement};`);
      }

      buffer = "";
    }
  }

  const tail = buffer.trim();
  if (tail) {
    statements.push(tail.endsWith(";") ? tail : `${tail};`);
  }

  return statements;
}

async function migrateV2() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  console.log("Connected to MySQL");

  const migrationsDir = path.resolve(__dirname, "../../nodejs/sql/v2");
  const files = await fs.readdir(migrationsDir);
  const sqlFiles = files.filter((file) => file.endsWith(".sql")).sort();

  for (const file of sqlFiles) {
    console.log(`Applying v2 migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sql = await fs.readFile(filePath, "utf8");

    try {
      const statements = sql.includes("DELIMITER")
        ? parseSqlFile(sql)
        : splitSqlStatements(sql);

      for (const [index, statement] of statements.entries()) {
        try {
          await connection.query(statement);
        } catch (error) {
          error.statementIndex = index + 1;
          error.statementPreview = compactSqlPreview(statement);
          throw error;
        }
      }
      console.log(`Successfully applied ${file}`);
    } catch (error) {
      console.error(`Failed to apply ${file}:`, error.message);
      if (error.statementIndex) {
        console.error(`Statement #${error.statementIndex}: ${error.statementPreview}`);
      }
      throw error;
    }
  }

  await connection.end();
  console.log("V2 migrations complete");
}

migrateV2().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
