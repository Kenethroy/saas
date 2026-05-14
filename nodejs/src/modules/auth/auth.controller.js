import { successResponse } from "#shared/utils/response";
import { AuthService } from "#modules/auth/auth.service";
import { env } from "#config/env";
import { AppError } from "#shared/utils/app-error";
import { withTimeout } from "#shared/utils/timeout";
import { logger } from "#shared/logger/index";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class AuthController {
  constructor(service = new AuthService()) {
    this.service = service;
  }

  register = async (req, res, next) => {
    try {
      const user = await this.service.register(req.body, {
        ipAddress: getPersistedRequestIp(req)
      });
      res.status(201).json(
        successResponse({
          message: "Bootstrap admin registered successfully",
          data: user
        })
      );
    } catch (error) {
      next(error);
    }
  };

  login = async (req, res, next) => {
    try {
      const persistedIp = getPersistedRequestIp(req);
      logger.info({ ip: persistedIp, requestIp: req.ip }, "Auth login request started");

      const result = await withTimeout(
        this.service.login(req.body, {
          ipAddress: persistedIp,
          userAgent: req.headers["user-agent"] ?? null
        }),
        env.AUTH_LOGIN_TIMEOUT_MS,
        () => new AppError("Login temporarily unavailable (database timeout).", 503)
      );

      res.status(200).json(
        successResponse({
          message: "Login successful",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };

  logout = async (req, res, next) => {
    try {
      await this.service.logout(req.auth.token);
      res.status(200).json(
        successResponse({
          message: "Logged out successfully"
        })
      );
    } catch (error) {
      next(error);
    }
  };

  currentUser = async (req, res, next) => {
    try {
      const user = await this.service.currentUser(req.auth.user.id);
      res.status(200).json(
        successResponse({
          message: "Current user retrieved successfully",
          data: user
        })
      );
    } catch (error) {
      next(error);
    }
  };

  sessions = async (req, res, next) => {
    try {
      const sessions = await this.service.listSessions(req.auth.user.id, req.auth.token);
      res.status(200).json(
        successResponse({
          message: "Active sessions retrieved successfully",
          data: sessions
        })
      );
    } catch (error) {
      next(error);
    }
  };

  logoutOtherSessions = async (req, res, next) => {
    try {
      const result = await this.service.logoutOtherSessions(req.auth.user.id, req.auth.token);
      res.status(200).json(
        successResponse({
          message: "Other sessions revoked successfully",
          data: result
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
