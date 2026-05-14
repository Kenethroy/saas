import pinoHttp from "pino-http";
import { logger } from "#shared/logger/index";

export const requestLogger = pinoHttp({
  logger
});
