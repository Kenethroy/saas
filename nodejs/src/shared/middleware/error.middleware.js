import { logger } from "#shared/logger/index";

export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.APP_ENV === "development") {
    logger.error({
      err,
      method: req.method,
      url: req.originalUrl
    }, "Request error");
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      errors: err.errors,
      stack: err.stack
    });
  } else {
    // Production: don't leak error details
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        ...(err.errors && { errors: err.errors })
      });
    } else {
      logger.error({
        err,
        method: req.method,
        url: req.originalUrl
      }, "NON-OPERATIONAL ERROR");
      res.status(500).json({
        status: "error",
        message: "Something went very wrong!"
      });
    }
  }
};

export const notFoundHandler = (req, res, next) => {
  const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  err.statusCode = 404;
  next(err);
};
