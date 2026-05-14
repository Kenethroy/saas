import jwt from "jsonwebtoken";
import { env } from "#config/env";

export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
