import pino from "pino";
import { env } from "#config/env";

export const logger = pino({
  level: env.APP_ENV === "production" ? "info" : "debug",
  transport: {
    targets: [
      {
        target: "pino-pretty",
        options: { colorize: true },
        level: env.APP_ENV === "production" ? "info" : "debug",
      },
      {
        target: "pino/file",
        options: { destination: "logs/app.log", mkdir: true },
        level: "info",
      },
    ],
  },
});
