import { AssistantService } from "#modules/assistant/assistant.service";
import { successResponse } from "#shared/utils/response";
import { getPersistedRequestIp } from "#shared/utils/request-ip";

export class AssistantController {
  constructor(service = new AssistantService()) {
    this.service = service;
  }

  query = async (req, res, next) => {
    try {
      const data = await this.service.query({
        question: req.body.question,
        context: req.body.context ?? {},
        user: req.auth?.user,
        ipAddress: getPersistedRequestIp(req),
        userAgent: req.headers["user-agent"] ?? null
      });

      res.status(200).json(
        successResponse({
          message: "Assistant response generated successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  status = async (_req, res, next) => {
    try {
      const data = await this.service.getStatus();

      res.status(200).json(
        successResponse({
          message: "Assistant status retrieved successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };

  reindex = async (req, res, next) => {
    try {
      const data = await this.service.reindex({
        scope: req.body.scope,
        limit: req.body.limit,
        user: req.auth?.user,
        ipAddress: getPersistedRequestIp(req),
        userAgent: req.headers["user-agent"] ?? null
      });

      res.status(200).json(
        successResponse({
          message: "Assistant reindex completed successfully",
          data
        })
      );
    } catch (error) {
      next(error);
    }
  };
}
