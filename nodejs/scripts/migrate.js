import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  console.log("Connected to MySQL");

  const dbName = process.env.DB_NAME || "jrspc_node";
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.query(`USE \`${dbName}\``);

  const migrationsDir = path.resolve(__dirname, "../../nodejs/sql/migrations");
  const files = await fs.readdir(migrationsDir);
  const sqlFiles = files.filter(f => f.endsWith(".sql")).sort();

  for (const file of sqlFiles) {
    console.log(`Applying migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sql = await fs.readFile(filePath, "utf8");
    
    // Split by semicolon but ignore inside quotes
    // For simplicity, we use multipleStatements: true and just run the whole file
    try {
      await connection.query(sql);
      console.log(`Successfully applied ${file}`);
    } catch (err) {
      console.error(`Failed to apply ${file}:`, err.message);
      // Continue or exit based on error
    }
  }

  await connection.end();
  console.log("Migrations complete");
}

migrate().catch(console.error);
