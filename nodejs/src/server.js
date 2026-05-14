import { createApp } from "#app";
import { env } from "#config/env";
import { logger } from "#shared/logger/index";
import pool from "#shared/database/mysql";

const app = createApp();

const server = app.listen(env.APP_PORT, env.APP_HOST, () => {
  logger.info(
    {
      port: env.APP_PORT,
      host: env.APP_HOST,
      env: env.APP_ENV
    },
    "JRSPC Node (Raw SQL) API started"
  );
});

async function shutdown(signal) {
  logger.info({ signal }, "Shutdown signal received");

  server.close(() => {
    logger.info("HTTP server closed");
  });

  try {
    await pool.end();
    logger.info("Database pool closed");
  } catch (err) {
    logger.error({ err }, "Database pool close failed");
  }

  setTimeout(() => process.exit(0), 1000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
