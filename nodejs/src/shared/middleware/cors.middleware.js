import { env } from "#config/env";

const allowedOrigins = env.FRONTEND_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  const allowAnyOrigin = allowedOrigins.includes("*");

  if (origin && (allowAnyOrigin || allowedOrigins.includes(origin))) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
  }

  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
}
